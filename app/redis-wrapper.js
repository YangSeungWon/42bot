const redis = require('redis');
const client = redis.createClient({
    socket: {
        host: "redis",
        port: 6379,
    }
});

const LIKING = ['good', 'bad'];
const KEY = {
    CHANNELID: "channel_id",
    TIMESTAMP: "timestamp",
    RESTAURANTS: "restaurants",
    PARTICIPANTS: "participants",
};

class RedisWrapper {
    async connect() {
        return client.connect();
    }

    async create(cid, ts) {
        // if already exists
        //      die
        const tsDatabase = await this.getTimestamp();
        if (tsDatabase) {
            return new Promise.reject();
        }

        // save
        return Promise.all([
            this.setChannelID(cid), 
            this.setTimestamp(ts)
        ]);
    }

    async getChannelID() {
        return client.get(KEY.CHANNELID);
    }

    async getTimestamp() {
        return client.get(KEY.TIMESTAMP);
    }

    async setChannelID(cid) {
        return client.set(KEY.CHANNELID, cid);
    }

    async setTimestamp(ts) {
        return client.set(KEY.TIMESTAMP, ts);
    }

    async getNumParticipants() {
        return client.sCard(KEY.PARTICIPANTS);
    }

    async getParticipants() {
        return client.sMembers(KEY.PARTICIPANTS);
    }

    async addParticipant(who) {
        return client.sAdd(KEY.PARTICIPANTS, who);
    }

    keyRestaurantLiking(what, liking) {
        return `${what}:${liking}`;
    }

    async removeVoter(who, what) {
        return Promise.all(LIKING.map(async (value) => {
            return client.sRem(this.keyRestaurantLiking(what, value), who);
        }));
    }

    async _vote(who, what, liking) {
        await this.removeVoter(who, what);
        await client.sAdd(this.keyRestaurantLiking(what, liking), who);
    }

    async vote(who, what, liking) {
        return Promise.all([
            this.addParticipant(who),
            this._vote(who, what, liking),
        ]);
    }

    async getNumRestaurants() {
        return client.sCard(KEY.RESTAURANTS);
    }

    async getRestaurants() {
        return client.sMembers(KEY.RESTAURANTS);
    }

    async addRestaurant(what) {
        return client.sAdd(KEY.RESTAURANTS, what);
    }

    async getVotersLiking(what, liking) {
        return client.sMembers(this.keyRestaurantLiking(what, liking));
    }

    async getVotersFor(what) {
        return new Promise(async (resolve, reject) => {
            const results = {};
            const votersPerLiking = await Promise.all(LIKING.map(async (value) => {
                return new Promise(async (resolve, reject) => {
                    const votersLiking = await this.getVotersLiking(what, value);
                    resolve(votersLiking);
                });
            }));
            LIKING.forEach((liking, index) => {
                results[liking] = votersPerLiking[index];
            });
            resolve(results);
        });
    }

    async getVotersForAll() {
        return new Promise(async (resolve, reject) => {
            const results = {};
            const restaurants = await this.getRestaurants();
            const votersPerRestaurants = await Promise.all(restaurants.map(async (value) => {
                return this.getVotersFor(value);
            }));
            restaurants.forEach((restaurant, index) => {
                results[restaurant] = votersPerRestaurants[index];
            });
            resolve(results);
        });
    }

    async getData() {
        const [cid, ts, participants, restaurants, voters] = await Promise.all([
            this.getChannelID(),
            this.getTimestamp(),
            this.getParticipants(),
            this.getRestaurants(),
            this.getVotersForAll(),
        ]);
        return {
            "cid": cid,
            "ts": ts,
            "participants": participants,
            "restaurants": restaurants,
            "voters": voters,
        };
    }

    async removeData() {
        return Promise.all([
            client.del(KEY.CHANNELID),  
            client.del(KEY.TIMESTAMP),  
            client.del(KEY.PARTICIPANTS),   
            client.del(KEY.RESTAURANTS),    
        ]);
    }
}

module.exports = RedisWrapper;
