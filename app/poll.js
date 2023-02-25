class Option {
    constructor(emoji, voters = []) {
        this.emoji = emoji;
        this.voters = voters;
    }

    stringify() {
        return `${this.emoji} - \`${this.voters.length}\` ${this.voters.join(', ')}`;
    }
    
    static parse(option) {
        const matches = option.text.text.match(
            /(:[^ ]+:) - \`[\d+]\` (.*)/
        );
        if (matches === null) {
            throw new Error('Provided option is malformed.');
        }
        const emoji = matches[1];
        const voters = matches[2] ? matches[2].split(', ') : [];
        return new Option(emoji, voters);
    }

    getScore() {
        const score = {
            ':heart_eyes:': +1,
            ':face_with_symbols_on_mouth:': -1,
        };
        return score[this.emoji] * this.voters.length;
    }

    getVoters() {
        return this.voters;
    }

    getNumVoters() {
        return this.voters.length;
    }

    vote(voter) {
        if (this.voters.includes(voter)) {
            this.voters = this.voters.filter(elem => elem !== voter);
        } else {
            this.voters.push(voter);
        }
    }

    unvote(voter) {
        this.voters = this.voters.filter(elem => elem !== voter);
    }
}

class Preference {
    constructor(options=null) {
        if (!options) {
            const base = [
                ':heart_eyes:',
                ':face_with_symbols_on_mouth:',
            ];
            this.options = base.map((elem) => new Option(elem));
        } else {
            this.options = options;
        }
    }

    stringify() {
        return this.options.map((elem) => {
            elem.stringify()
        }).join(' ');
    }

    stringifyBlock() {
        return this.options.map((elem) => {
            return {
                "text": {
                    "type": "mrkdwn",
                    "text": elem.stringify(),
                },
                "value": elem.emoji
            }
        })
    }
    
    static parse(raw_options) {
        let options = [];
        for (let i = 0; i < raw_options.length; i++) {
            options.push(
                Option.parse(raw_options[i])
            );
        }
        return new Preference(options);
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
        const result = this.options.reduce((sum, obj) => sum + obj.getScore(), 0);
        return result;
    }

    vote(voter, selected) {
        this.options.forEach((elem) => {
            if (elem.emoji === selected) {
                elem.vote(voter);
            } else {
                elem.unvote(voter);
            }
        });
    }
}


class Candidate {
    constructor(id, name, url, numParticipants = 0, score = 0.0, preference = null, block_id = 'unknown') {
        this.id = id;
        this.name = name;
        this.url = url;
        this.numParticipants = numParticipants
        this.score = score;
        this.preference = preference ?? new Preference();
        this.block_id = block_id;
    }

    stringify() {
        this.updateScore();
        return `~${this.id}~ ${Preference.getEmoji(this.score / Math.max(1, this.numParticipants))} \
<${this.url}|${this.name}> \
\`${this.score}\``
    }

    stringifyBlock() {
        return {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": this.stringify(),
            },
            "accessory": {
                "type": "radio_buttons",
                "options": this.preference.stringifyBlock(),
                "action_id": "vote",
            }
        }
    }

    static parse(block, numParticipants) {
        const matches = block.text.text.match(
            /~(\d+)~ :[^:]+: <([^\|]*)\|([^>]*)> `([-\.\d]+)`/s
        );
        if (matches === null) {
            throw new Error('Provided option is malformed.');
        }
        const id = parseInt(matches[1], 10);
        const url = matches[2];
        const name = matches[3];
        const score = parseFloat(matches[4]);

        const preference = Preference.parse(block.accessory.options);
        return new Candidate(
            id, name, url, numParticipants, score, preference,
            block.block_id
        );
    }

    vote(voter, selected) {
        this.preference.vote(voter, selected);
    }

    updateScore() {
        this.score = this.preference.getScore();
    }
}


class Information {

    constructor(initTime = new Date().toLocaleString(), participants = []) {
        this.initTime = initTime;
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
    
    static parse(option) {
        const matches = option.text.text.match(
            /\[42\] (.+), participants: \`\d+\` - (.*)/
        );
        if (matches === null) {
            throw new Error('Provided option is malformed.');
        }
        const initTime = matches[1];
        const participants = matches[2] ? matches[2].split(', ') : [];
        return new Information(initTime, participants);
    }

    participate(id) {
        this.participants.add(id);
    }

    getNumParticipants() {
        return this.participants.size;
    }
}


class Poll {
    constructor() {
        this.information = new Information();
        this.candidates = [];
    }

    stringifyBlock() {
        return [
            this.information.stringifyBlock()
        ].concat(this.candidates.map((elem) => 
            elem.stringifyBlock()
        )).concat([{
            "type": "divider",
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Load more option :whale:",
                        "emoji": true,
                    },
                    "action_id": "load_more_option",
                },
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

    parse(blocks) {
        for (let i = 0; i < blocks.length; i++) {
            if (i >= blocks.length - 3) {
                // Skip the last three elements
                continue;
            }

            if (i === 0) {
                this.information = Information.parse(blocks[i]);
                continue;
            }

            this.candidates.push(
                Candidate.parse(blocks[i], this.information.getNumParticipants())
            );
        }
    }

    participate(id) {
        this.information.participate(id);
    }

    add(id, name, url) {
        this.candidates.push(
            new Candidate(parseInt(id,10), name, url, this.information.getNumParticipants())
        );
    }

    vote(block_id, voter, selected) {
        this.participate(voter);
        const candidate = this.candidates.find((elem) =>
            elem.block_id === block_id
        );
        candidate.vote(voter, selected);
    }

    getScores() {
        return this.candidates.reduce((acc, elem) => {
            acc[elem.id] = elem.score;
            return acc;
        }, {});
    }

    getNumParticipants() {
        return this.information.getNumParticipants();
    }
}

module.exports = Poll;
