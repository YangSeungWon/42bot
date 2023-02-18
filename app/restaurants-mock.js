const Database = require('./database');

class Restaurants {
    constructor(config) {
        this.TABLE_NAME = 'restaurants';
        this.db = [{
            'id': 0,
            'name': '영',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 10.0,
        },{
            'id': 1,
            'name': '일',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 20.0,
        },{
            'id': 2,
            'name': '이',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 20.0,
        },{
            'id': 3,
            'name': '삼',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 10.0,
        },{
            'id': 4,
            'name': '사',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 50.0,
        },{
            'id': 5,
            'name': '오',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 40.0,
        },{
            'id': 6,
            'name': '육',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 22.0,
        },{
            'id': 7,
            'name': '칠',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 10.0,
        },{
            'id': 8,
            'name': '팔',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 10.0,
        },{
            'id': 9,
            'name': '구',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 77.0,
        },{
            'id': 10,
            'name': '십',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 10.0,
        },{
            'id': 11,
            'name': '십일',
            'url': 'https://baemin.me/3LwUw6pNE',
            'count': 0,
            'score': 10.0,
        },];
    }

    async create(name, url) {
        this.db.push({
            'id': this.db.length,
            'name': name,
            'url': url,
            'count': 0,
            'score': 100.0,
        });

        return this.db.length -1;
    }

    async getByName(name) {
        return [this.db.find((elem) => elem.name === name)];
    }

    async getAll() {
        return this.db;
    }

    async getInit(num) {
        return this.db
            .sort((a,b)=>{if(a.score<b.score){return 1;}if(a.score>b.score){return -1;}return 0;})
            .slice(0, num);
    }

    async getNext(num) {
        return this.db
            .sort((a,b)=>{if(a.score<b.score){return 1;}if(a.score>b.score){return -1;}return 0;})
            .slice(num, num+1);
    }

    async increaseCount(id) {
        this.db.find((elem) => elem.id === id).count++;
    }

    async increaseScore(id, score) {
        this.db.find((elem) => elem.id === id).score += score;
    }

    async maximizeScore(id) {
        this.db.find((elem) => elem.id === id).score = 100.0;
    }

    async decayScore(score) {
        this.db.forEach((elem) => {elem.score /= 2;});
    }
}

module.exports = Restaurants;
