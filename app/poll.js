const debug = process.env.debug;
let Restaurants;
if (debug) {
    Restaurants = require('./restaurants-mock');
} else {
    Restaurants = require('./restaurants');
}
const db = new Restaurants({
    host: 'db',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

const RedisWrapper = require('./redis-wrapper');
const redis = new RedisWrapper();

function randomString() {
    const length = 30;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

class Preference {
    constructor(name, liking, voters) {
        const EMOJI = {
            'good': ':heart_eyes:',
            'bad': ':face_with_symbols_on_mouth:',
        };
        
        const SCORE = {
            'good': +1,
            'bad': -1,
        };

        this.name = name;
        this.liking = liking;
        this.emoji = EMOJI[liking];
        this.score = SCORE[liking];
        this.voters = voters;
    }

    stringify() {
        return `${this.emoji.repeat(this.voters.length + 1)}`;
    }

    stringifyBlock(user) {
        let ret = {
            "type": "button",
            "text": {
                "type": "plain_text",
                "text": this.stringify(),
                "emoji": true
            },
            "value": `${this.name}:${this.liking}`,
            "action_id": `vote${randomString()}`
        }
        if (this.voters.includes(user)) {
            ret["style"] = "primary";
        }
        return ret;
    }

    static getEmoji(score) {
        if (score <= 0.0) {
            return ":large_red_square:";
        } else if (score <= 0.3) {
            return ":large_orange_square:";
        } else if (score <= 0.6) {
            return ":large_yellow_square:";
        } else if (score <= 0.9) {
            return ":large_green_square:";
        } else {
            return ":large_blue_square:";
        }
    }

    getScore() {
        return this.score * this.voters.length;
    }
}


class Candidate {
    constructor(restaurant, info, voters, numParticipants) {
        this.score = 0;
        this.preferences = Object.keys(voters).map((liking) => {
            const preference = new Preference(restaurant, liking, voters[liking]);
            this.score += preference.getScore();
            return preference;
        })

        this.name = restaurant;
        this.url = info['url'];
        this.id = info['id'];
        this.count = info['count'];
        this.lastOrder = info['lastOrder'];
        this.numParticipants = numParticipants;
    }

    stringify() {
        return `${Preference.getEmoji(this.score / Math.max(1, this.numParticipants))} \
${this.score} : \
${this.name}`
    }

    stringifyBlock(user) {
        return {
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": this.stringify(),
						"emoji": true
					},
					"url": this.url,
				}
			].concat(this.preferences.map((pf) => pf.stringifyBlock(user)))
		}
    }
}


class Information {

    constructor(initTime = null, participants = []) {
        this.initTime = (initTime ? new Date(initTime*1000) : new Date()).toLocaleString();
        this.participants = new Set(participants);
    }
    
    stringify() {
        return `[42] ${this.initTime}, participants: \`${this.participants.size}\` - ${Array.from(this.participants).join(', ')}`;
    }

    stringifyBlock() {
        return {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": this.stringify(),
            }
        };
    }

    getNumParticipants() {
        return this.participants.size;
    }
}

class Poll {
    constructor(cid=null, ts=null, participants=[], restaurants=[], infos=[], voters={}) {
        if (ts) {
            this.information = new Information(ts, participants);
        } else {
            this.information = new Information();
        }

        if (restaurants) {
            this.candidates = restaurants.map((restaurant) => {
                const info = infos.filter((info) => info.name === restaurant)[0];
                return new Candidate(restaurant, info, voters[restaurant], participants.length)
            });
            this.candidates.sort((a, b) => b.score - a.score);
        } else {
            this.candidates = [];
        }
    }

    static async connect() {
        return redis.connect();
    }

    static async init() {
        await redis.removeData();
        return Promise.resolve(new Poll());
    }

    static async setup(cid, ts) {
        return Promise.all([
            redis.setChannelID(cid),
            redis.setTimestamp(ts),
        ]);
    }

    static async load() {
        const data = await redis.getData();
        const {cid, ts, participants, restaurants, voters} = data;
        const infos = await db.getByNames(restaurants)
        return Promise.resolve(new Poll(cid, ts, participants, restaurants, infos, voters));
    }

    static findNameByBlockID(blocks, block_id) {
        const block = blocks.find((block) => block.block_id === block_id);
        const matches = block.text.text.match(/:[^:]+: <([^\|]*)\|([^>]*)> `([-\.\d]+)`/s)
        const name = matches[2];
        return name;
    }

    stringifyBlock(user) {
        const insertIntoArray = (arr, value) => {
            return arr.reduce((result, element, index, array) => {
                result.push(element);
                if (index < array.length - 1) {
                    result.push(value);
                }
                return result;
            }, []);
        };

        return [
            this.information.stringifyBlock()
        ].concat(
            insertIntoArray(this.candidates.map((elem) => 
                elem.stringifyBlock(user)
            ), {"type": "divider",}
        )
        ).concat([{
            "type": "divider",
        },
        {
            "type": "section",
            "block_id": "load",
            "text": {
              "type": "mrkdwn",
              "text": "Load more option :whale:"
            },
            "accessory": {
              "action_id": "load_more_option",
              "type": "external_select",
              "min_query_length": 0,
            }
        },
        {
            "type": 'input',
            "dispatch_action": true,
            "element": {
                "type": 'plain_text_input',
                "action_id": "add_option",
                "dispatch_action_config": {
                  "trigger_actions_on": ["on_character_entered"]
                },
                "placeholder": {
                    "type": 'plain_text',
                    "text": 'Paste here',
                },
            },
            "label": {
                "type": 'plain_text',
                "text": "Add Option :whale2:",
            },
        },
        {
            type: "actions",
            elements: [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Cancel Poll",
                        "emoji": true,
                    },
                    "confirm": {
                        "title": {
                            "type": "plain_text",
                            "text": "Are you sure to cancel the poll?",
                        },
                        "text": {
                            "type": "mrkdwn",
                            "text": "Please make sure that everyone has agreed to it.",
                        },
                        "confirm": {
                            "type": "plain_text",
                            "text": "Cancel it.",
                        },
                        "deny": {
                            "type": "plain_text",
                            "text": "Stop, I've changed my mind!",
                        },
                    },
                    "action_id": "cancel_poll",
                }
            ]
        },
        {
            type: "actions",
            elements: [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Close Poll",
                        "emoji": true,
                    },
                    "style": "danger",
                    "confirm": {
                        "title": {
                            "type": "plain_text",
                            "text": "Are you sure to close the poll?",
                        },
                        "text": {
                            "type": "mrkdwn",
                            "text": "Please make sure that everyone has agreed to it.",
                        },
                        "confirm": {
                            "type": "plain_text",
                            "text": "Close it.",
                        },
                        "deny": {
                            "type": "plain_text",
                            "text": "Stop, I've changed my mind!",
                        },
                    },
                    "action_id": "close_poll",
                }
            ]
        }]);
    }

    stringifyBlockClosed() {
        return [
            this.information.stringifyBlock()
        ].concat(this.candidates.map((elem) => {
            return {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": elem.stringify(),
                },
            }
        }));
    }

    static async add(name, url) {
        let id;
        const res = await db.getByName(name)
        if (!res || res.length === 0 || !res[0]) {
            id = await db.create(name, url);
        }
        return redis.addRestaurant(name);
    }

    static async vote(name, voter, selected) {
        return redis.vote(
            voter,
            name,
            selected,
        );
    }

    getScores() {
        return this.candidates.reduce((acc, elem) => {
            acc[elem.id] = elem.score;
            return acc;
        }, {});
    }

    async getPossibleOptions() {
        const [candidates, options] = await Promise.all([
            db.getAll(),
            redis.getRestaurants(),
        ]);

        const ready = candidates.filter(cand => !options.includes(cand['name']))

        return ready.map((cand) => {
            return {
                text: {
                    type: 'plain_text',
                    text: `${cand['name']}; count: ${cand['count']}`,
                },
                value: cand['name'],
            }
        });
    }

    static async close() {
        return redis.removeData();
    }

    async conclude() {
        const scores = this.getScores();
        const num = this.information.getNumParticipants();
        let promises = [];
        for (const id in scores) {
            promises.push(db.decayScore(id, Math.max(0.5, scores[id] / num)));
        }
        await Promise.all(promises);

        const winnerId = Object.keys(scores).reduce((prev, curr) =>
            scores[prev] > scores[curr] ? prev : curr
        );
        await db.increaseCount(winnerId);
        await db.maximizeScore(winnerId);
    }
}

module.exports = Poll;
