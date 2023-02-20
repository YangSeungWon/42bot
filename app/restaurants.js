const Database = require('./database');

class Restaurants {
    constructor(config) {
        this.db = new Database(config);
        this.TABLE_NAME = 'restaurants';
    }

    async create(name, url) {
        return this.db.insert(this.TABLE_NAME, {
            'name': name,
            'url': url,
            'count': 0,
            'score': 100.0,
        });
    }

    async getByName(name) {
        return this.db.select(this.TABLE_NAME, {'name': name});
    }

    async getAll() {
        return this.db.select(this.TABLE_NAME, {}, 'score');
    }

    async getInit(num) {
        return this.db.select(this.TABLE_NAME, {}, 'score', num);
    }

    async getNext(num) {
        return this.db.select(this.TABLE_NAME, {}, 'score', 1, num);
    }

    async increaseCount(id) {
        return this.db.increase(this.TABLE_NAME, { 'count': 1 }, { 'id': id });
    }

    async increaseScore(id, score) {
        return this.db.increase(this.TABLE_NAME, { 'score': score }, { 'id': id });
    }

    async maximizeScore(id) {
        return this.db.update(this.TABLE_NAME, { 'score': 100.0 }, { 'id': id });
    }

    async decayScore() {
        return this.db.multiply(this.TABLE_NAME, { 'score': 0.9 });
    }
}

module.exports = Restaurants;
