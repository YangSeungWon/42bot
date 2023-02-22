class Option {
    constructor(emoji, voters = []) {
        this.emoji = emoji;
        this.voters = voters;
    }

    stringify() {
        return `${this.emoji} - ${this.voters.join(', ')}`;
    }
    
    static parse(option) {
        const matches = option.text.text.match(
            /(:[^ ]+:) - (.*)/
        );
        if (matches === null) {
            throw new Error('Provided option is malformed.');
        }
        const emoji = matches[1];
        const voters = matches[2] ? matches[2].split(', ') : [];
        return new Option(emoji, voters);
    }

    getValence() {
        const valence = {
            ':face_with_symbols_on_mouth:': 1,
            ':face_with_raised_eyebrow:': 3,
            ':yum:': 7,
            ':heart_eyes:': 9,
        };
        return valence[this.emoji] * this.voters.length;
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
                ':face_with_symbols_on_mouth:',
                ':face_with_raised_eyebrow:',
                ':yum:',
                ':heart_eyes:',
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
                    "type": "plain_text",
                    "text": elem.stringify(),
                    "emoji": true,
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

    getValence() {
        const result = this.options.reduce((acc, obj) => {
            acc.sum += obj.getValence();
            acc.cnt += obj.getNumVoters();
            return acc;
        }, { sum: 0, cnt: 0 });
        const avg = result.cnt !== 0 ? result.sum / result.cnt : 5.0;
        return avg;
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
    constructor(id, name, url, valence = 5.0, preference = null, block_id = 'unknown') {
        this.id = id;
        this.name = name;
        this.url = url;
        this.valence = valence;
        this.preference = preference ?? new Preference();
        this.block_id = block_id;
    }

    stringify() {
        this.updateValence();
        return `~${this.id}~ :arrow_forward: \
<${this.url}|${this.name}> \
\`${this.valence}\``
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

    static parse(block) {
        const matches = block.text.text.match(
            /~(\d+)~ :arrow_forward: <([^\|]*)\|([^>]*)> `([\.\d]+)`/s
        );
        if (matches === null) {
            throw new Error('Provided option is malformed.');
        }
        const id = parseInt(matches[1], 10);
        const url = matches[2];
        const name = matches[3];
        const valence = parseFloat(matches[4]);

        const preference = Preference.parse(block.accessory.options);
        return new Candidate(
            id, name, url, valence, preference,
            block.block_id
        );
    }

    vote(voter, selected) {
        this.preference.vote(voter, selected);
    }

    updateValence() {
        this.valence = this.preference.getValence();
    }
}


class Poll {
    constructor() {
        this.candidates = [];
    }

    stringifyBlock() {
        return this.candidates.map((elem) => 
            elem.stringifyBlock()
        ).concat([{
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

    stringifyClosed() {
        return this.candidates.map((elem) => {
            return {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": elem.stringify(),
                },
            }
        });
    }

    parse(blocks) {
        for (let i = 0; i < blocks.length; i++) {
            if (i >= blocks.length - 3) {
                // Skip the last three elements
                continue;
            }
            this.candidates.push(
                Candidate.parse(blocks[i])
            );
        }
    }

    add(id, name, url) {
        this.candidates.push(
            new Candidate(id, name, url)
        );
    }

    vote(block_id, voter, selected) {
        const candidate = this.candidates.find((elem) =>
            elem.block_id === block_id
        );
        candidate.vote(voter, selected);
    }

    getWinner() {
        return this.candidates.reduce((prev, current) => (prev.voters.length > current.voters.length) ? prev : current);
    }
}

module.exports = Poll;
