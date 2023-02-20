class Candidate {
    constructor(id, name, url, count = 0, voters = [], block_id = 'unknown') {
        this.id = id;
        this.name = name;
        this.url = url;
        this.count = count;
        this.voters = voters;
        this.block_id = block_id;
    }

    stringify() {
        return `~${this.id}~ :arrow_forward: \
<${this.url}|${this.name}> \
\`${this.count}\` \
${this.voters.join(', ')}`
    }

    static parse(block) {
        const matches = block.text.text.match(
            /~(\d+)~ :arrow_forward: <([^\|]*)\|([^>]*)> `(\d+)` (.*)/
        );
        if (matches === null) {
            throw new Error('Provided option is malformed.');
        }
        const id = matches[1];
        const url = matches[2];
        const name = matches[3];
        const count = matches[4];
        const voters = matches[5].split(', ');
        return new Candidate(
            parseInt(id, 10), name, url, parseInt(count, 10), voters,
            block.block_id
        );
    }

    vote(voter) {
        if (this.voters.includes(voter)) {
            this.unvote(voter);
            return;
        }
        this.count += 1;
        this.voters.push(voter);
    }

    unvote(voter) {
        if (!this.voters.includes(voter)) {
            this.vote(voter);
            return;
        }
        this.count -= 1;
        this.voters = this.voters.filter((elem) =>
            elem !== voter
        );
    }
}


class Poll {
    constructor() {
        this.candidates = [];
    }

    stringify() {
        return this.candidates.map((elem) => {
            return {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": elem.stringify(),
                },
                "accessory": {
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": ":white_check_mark:",
                        "emoji": true,
                    },
                    "action_id": "vote",
                }
            }
        }).concat([{
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

    vote(block_id, voter) {
        const candidate = this.candidates.find((elem) =>
            elem.block_id === block_id
        );
        candidate.vote(voter);
    }

    unvote(block_id, voter) {
        const candidate = this.candidates.find((elem) =>
            elem.block_id === block_id
        );
        candidate.unvote(voter);
    }

    getWinner() {
        return this.candidates.reduce((prev, current) => (prev.voters.length > current.voters.length) ? prev : current);
    }
}

module.exports = Poll;
