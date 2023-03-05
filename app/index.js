require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const { App } = require('@slack/bolt');
const app = new App({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    token: process.env.SLACK_BOT_TOKEN,
});
const web = new WebClient(process.env.SLACK_BOT_TOKEN);
const PORT = 24842;

const Poll = require('./poll');


async function postEphemeral(channelId, userId, text) {
    const result = await web.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: text
    });
}

app.options('load_more_option', async ({ options, ack }) => {
    try {
        const poll = await Poll.load();
        const options = await poll.getPossibleOptions();
        await ack({ options: options});
    } catch (e) { 
        console.error(e);
        await ack();
    }
})


app.action('load_more_option', async ({ body, ack, say }) => {
    try {
        await ack();

        const selected = body.actions[0].selected_option.value;
        await Poll.add(selected);
        const poll = await Poll.load();

        await web.chat.update({
            blocks: poll.stringifyBlock(),
            text: 'It is time to choose what to eat.',
            channel: body.channel.id,
            ts: body.message.ts,
            unfurl_links: false,
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

        await Poll.add(name, url);

        const poll = await Poll.load();

        await web.chat.update({
            blocks: poll.stringifyBlock(),
            text: 'It is time to choose what to eat.',
            channel: body.channel.id,
            ts: body.message.ts,
            unfurl_links: false,
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

        const poll = await Poll.load();
        await Poll.close();

        await web.chat.update({
            blocks: poll.stringifyBlockClosed(),
            text: 'It is time to choose what to eat.',
            channel: body.channel.id,
            ts: body.message.ts,
            unfurl_links: false,
        });

        await poll.conclude();

    } catch (error) {
        console.error(error);
    }
});

app.action('vote', async ({ body, ack, say }) => {
    try {
        await ack();

        const matches = body.actions[0].selected_option.value.match(
            /([^:]+):(.*)/
        );
        const name = matches[1];
        const liking = matches[2];

        await Poll.vote(
            name,
            `<@${body.user.id}>`,
            liking,
        );

        const poll = await Poll.load();

        await web.chat.update({
            blocks: poll.stringifyBlock(),
            text: 'It is time to choose what to eat.',
            channel: body.channel.id,
            ts: body.message.ts,
            unfurl_links: false,
        });
    } catch (error) {
        console.error(error);
    }
});


app.command('/42', async ({ command, ack, say }) => {
    await ack();
    const poll = await Poll.init();
    const response = await say({
        blocks: poll.stringifyBlock(),
        text: 'It is time to choose what to eat.',
        unfurl_links: false,
    });
    const { channel, ts } = response;
    await Poll.setup(channel, ts);
});


(async () => {
    await app.start(PORT);
    console.log('Listening...');
    await Poll.connect();
})();

