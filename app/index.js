require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const { App } = require('@slack/bolt');
const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN,
});
const web = new WebClient(process.env.SLACK_BOT_TOKEN);
const PORT = 24842;

const Restaurants = require('./restaurants');
const restaurants = new Restaurants({
    host: 'db',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});


const Poll = require('./poll');


async function postEphemeral(channelId, userId, text) {
    const result = await web.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: text
    });
}


app.action('load_more_option', async ({ body, ack, say }) => {
    try {
        await ack();

        let poll = new Poll();
        poll.parse(body.message.blocks);
        const res = (await restaurants.getNext(poll.candidates.length))[0];
        if (!res) {
            postEphemeral(body.channel.id, body.user.id, 'There is no more options to load from the database.');
            throw new Error('There is no more options to load from the database.');
        }
        poll.add(res['id'], res['name'], res['url']);

        await web.chat.update({
            blocks: poll.stringify(),
            text: 'It is time to choose what to eat.',
            channel: body.channel.id,
            ts: body.message.ts,
            response_url: body.response_url
        });
    } catch (error) {
        console.error(error);
    }
});


app.action('add_option', async ({ ack, body, context }) => {
    try {
        await ack();
        const text = body.actions[0].value;

        const matches = text.match(/.*'([^']+)'.+(https:\/\/baemin\.me\/.[^\s]*).*/s);
        if (!text || matches === null) {
            // postEphemeral(body.channel.id, body.user.id, 'Provided option is malformed.');
            throw new Error('Provided option is malformed.');
        }
        const name = matches[1];
        const url = matches[2];

        let poll = new Poll();
        poll.parse(body.message.blocks);

        let id;
        const res = await restaurants.getByName(name)
        if (!res || res.length === 0 || !res[0]) {
            id = await restaurants.create(name, url);
        } else {
            id = res[0].id;
            if (poll.candidates.find((elem) =>
                elem.name === name
            )) {
                postEphemeral(body.channel.id, body.user.id, 'The option you have added is already in the poll.');
                return;
            }
        }

        poll.add(id, name, url);

        await web.chat.update({
            blocks: poll.stringify(),
            text: 'It is time to choose what to eat.',
            channel: body.channel.id,
            ts: body.message.ts,
            response_url: body.response_url
        });
    } catch (error) {
        console.error(error);
    }
});


app.action('close_poll', async ({ body, ack, say }) => {
    try {
        await ack();
        const { user, channel } = body;
        await say(`<@${user.id}> closed the poll in <#${channel.id}>`);

        let poll = new Poll();
        poll.parse(body.message.blocks);

        await web.chat.update({
            blocks: poll.stringifyClosed(),
            text: 'It is time to choose what to eat.',
            channel: body.channel.id,
            ts: body.message.ts,
            response_url: body.response_url
        });

        const id = poll.getWinner().id;
        await restaurants.increaseCount(id);
        await restaurants.maximizeScore(id);
        await restaurants.decayScore();
    } catch (error) {
        console.error(error);
    }
});


app.action('vote', async ({ body, ack, say }) => {
    try {
        await ack();

        let poll = new Poll();
        poll.parse(body.message.blocks);
        poll.vote(body.actions[0].block_id, `<@${body.user.id}>`);

        await web.chat.update({
            blocks: poll.stringify(),
            text: 'It is time to choose what to eat.',
            channel: body.channel.id,
            ts: body.message.ts,
            response_url: body.response_url
        });
    } catch (error) {
        console.error(error);
    }
});


app.command('/42', async ({ command, ack, say }) => {
    await ack();

    const list = await restaurants.getInit(5);
    let poll = new Poll();
    for (let i = 0; i < list.length; i++) {
        poll.add(list[i]['id'], list[i]['name'], list[i]['url']);
    }
    await say({
        blocks: poll.stringify(),
        text: 'It is time to choose what to eat.',
    });
});


(async () => {
    await app.start(PORT);
    console.log('Listening...');
})();

