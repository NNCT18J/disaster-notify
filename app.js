const cron = require('node-cron');
const moment = require('moment');
require('moment-timezone');
const request = require('request');
const fs = require('fs');
const loadJSON = (fileName) => { return JSON.parse(fs.readFileSync(fileName)) };
const config = loadJSON("./config.json");
moment.tz.setDefault('Asia/Tokyo');

const shindo = {
    10: 1,
    20: 2,
    30: 3,
    40: 4,
    45: '5弱',
    50: '5強',
    55: '6弱',
    60: '6強',
    70: 7
}

const tsunami = {
    None: "なし",
    Unknown: "不明",
    Checking: "調査中",
    NonEffective: "若干の海面変動[被害の心配なし]",
    Watch: "津波注意報",
    Warning: "津波予報[種類不明]"
}

let bufDate = moment();

const discordPost = (json) => {
    const post = (url) => {
        request({ url, method: "POST", json }, (error, response, body) => {
            if (error !== null) {
                console.error('error:', error);
                return (false);
            }
            if (response.statusCode !== 204) {
                console.log(response.statusCode);
                console.error('error:', body);
                return (false);
            }
        });
    }
    console.log(JSON.stringify(json, null, 2));
    if (typeof config.webhook.to === "string") {
        post(config.webhook.to)
    } else if (Array.isArray(config.webhook.to)) {
        config.webhook.to.forEach(url => post(url));
    } else {
        console.log("config.jsonが不正です！");
        return false;
    }

    return true;
}

const job = () => {
    request({ url: `https://api.p2pquake.net/v1/human-readable?limit=100`, headers: { 'User-Agent': 'nnct3j-bot' } }, (error, response, body) => {
        let data = JSON.parse(response.body);
        data.forEach(data => data.time = moment(data.time.split("/").join("-")));
        const dataFromKisho = data.filter(obj => obj.code === 551).filter(obj => obj.earthquake.maxScale >= 30);
        const dataFast = data.filter(obj => obj.code === 5610);
        if (dataFromKisho.some(obj => obj.time > bufDate)) {
            const data = dataFromKisho.find(obj => obj.time > bufDate);
            //const data = dataFromKisho[1];
            console.log(data);
            const isDanger = data.points.some(point => point.addr.indexOf(config.importantArea) !== -1);
            if (discordPost({
                "username": "緊急地震速報",
                "avatar_url": (isDanger) ? "https://cdn1.iconfinder.com/data/icons/color-bold-style/21/08-512.png" : "https://cdn.iconscout.com/icon/free/png-256/warning-notice-sign-symbol-38020.png",
                "content": `${((isDanger) ? `@everyone **${config.importantArea}での震度は${(shindo[data.points.find(point => point.addr.indexOf(config.importantArea) !== -1).scale])}**` : "")} **地震です: 気象庁の発表 **`,
                "embeds": [
                    {
                        "title": `気象庁より地震速報がありました`,
                        "description": `${data.earthquake.time}ごろ地震がありました．`
                            + (isDanger ? `**${config.importantArea}での震度は${(shindo[data.points.find(point => point.addr.indexOf(config.importantArea) !== -1).scale])}です．落ち着いて，身を守る行動を取ってください．**`
                                : `${config.importantArea}への影響はありません．`),
                        "timestamp": data.time.utc(),
                        "color": (isDanger) ? 0xFF0000 : 0xFFFF00,
                        "thumbnail": {
                            "url": (isDanger) ? "https://cdn1.iconfinder.com/data/icons/color-bold-style/21/08-512.png" : "https://cdn.iconscout.com/icon/free/png-256/warning-notice-sign-symbol-38020.png"
                        },
                        fields: ([{
                            name: "最大深度",
                            value: shindo[data.earthquake.maxScale],
                            inline: true
                        }, {
                            name: "津波の危険性",
                            value: tsunami[data.earthquake.domesticTsunami],
                            inline: true
                        }, {
                            name: "震源地",
                            value: (data.earthquake.hypocenter.name === "") ? "不明" : data.earthquake.hypocenter.name,
                            inline: true
                        }, {
                            name: "震源地の深度",
                            value: (data.earthquake.hypocenter.depth === "") ? "不明" : data.earthquake.hypocenter.depth,
                            inline: true
                        }, {
                            name: "マグニチュード",
                            value: (data.earthquake.hypocenter.magnitude === "") ? "不明" : data.earthquake.hypocenter.magnitude,
                            inline: true
                        }]).concat(data.points.reduce((a, c) => {
                            let t = a.find(v => v.scale == c.scale);
                            if (t !== undefined) {
                                if (c.addr.indexOf(config.importantArea) !== -1) {
                                    t.addr.unshift(c.addr);
                                } else {
                                    t.addr.push(c.addr);
                                }
                            } else {
                                a.push({
                                    scale: c.scale,
                                    addr: [c.addr]
                                });
                            }
                            return (a)
                        }, []).map(v => ({
                            name: `震度 ${shindo[v.scale]}`,
                            value: v.addr.join(", ").substr(0, 50)
                        }))).concat([
                            {
                                name: "地震情報をTwitterで確認する",
                                value: "[リンク](https://twitter.com/search?q=%E5%9C%B0%E9%9C%87+%E9%80%9F%E5%A0%B1)"
                            },
                            {
                                name: "Twitter: 特務機関NERV",
                                value: "[リンク](https://twitter.com/UN_NERV)"
                            }, {
                                name: "気象庁 | 地震情報",
                                value: "https://www.jma.go.jp/jp/quake/"
                            }
                        ])
                    }
                ]
            })) {
                bufDate = moment(data.time);
            }
        } else if (dataFast.some(obj => obj.time > bufDate && (Object.keys(obj.areas).some(name => name.indexOf(config.importantArea) !== -1)))) {
            console.log("it has");
            const data = dataFast.find(obj => obj.time > bufDate && (Object.keys(obj.areas).some(name => name.indexOf(config.importantArea) !== -1)));
            if (data.prefs[Object.keys(data.prefs).find(name => name.indexOf(config.importantPref) !== -1)] < 3) {
                //重要エリア件数3未満
                bufDate = moment(data.time);
                return;
            }
            if (discordPost({
                "username": "緊急地震速報",
                "avatar_url": "https://cdn1.iconfinder.com/data/icons/color-bold-style/21/08-512.png",
                "content": `@everyone **${config.importantArea}で地震発生．隠れて！**`,
                "embeds": [
                    {
                        "title": `地震を観測しました`,
                        "description": `**${config.importantArea}**を含むエリアで地震を観測しました．**隠れて！**`,
                        "timestamp": data.time.utc(),
                        "color": 0xFF0000,
                        "thumbnail": {
                            "url": "https://cdn1.iconfinder.com/data/icons/color-bold-style/21/08-512.png",
                        },
                        fields: ([{
                            name: `${config.importantArea}での地震感知情報の総件数`,
                            value: data.prefs[Object.keys(data.prefs).find(name => name.indexOf(config.importantPref) !== -1)] + " 件",
                            inline: false
                        }]).concat(Object.keys(data.areas).filter(name => name.indexOf(config.importantArea) !== -1).map(name => ({
                            name,
                            value: data.areas[name] + " 件",
                            inline: true
                        }))).concat(Object.keys(data.areas).filter(name => name.indexOf(config.importantArea) === -1).map(name => ({
                            name,
                            value: data.areas[name] + " 件",
                            inline: true
                        }))).concat([
                            {
                                name: "地震情報をTwitterで確認する",
                                value: "[リンク](https://twitter.com/search?q=%E5%9C%B0%E9%9C%87+%E9%80%9F%E5%A0%B1)"
                            },
                            {
                                name: "Twitter: 特務機関NERV",
                                value: "[リンク](https://twitter.com/UN_NERV)"
                            }, {
                                name: "気象庁 | 地震情報",
                                value: "https://www.jma.go.jp/jp/quake/"
                            }
                        ])
                    }
                ]
            })) {
                bufDate = moment(data.time);
            }
        } else {
            //console.log("地震はありません");
        }
    });

}

cron.schedule("*/2 * * * * *", () => {
    //console.log("job");
    job();
});

(() => {
    console.log("Running...");
    console.log(moment().format("HH:mm"));
    if (config.importantArea === undefined || config.importantPref === undefined || !((typeof config.webhook.to === "string") || (Array.isArray(config.webhook.to)))) {
        console.log("設定ファイルが不正です．https://github.com/NNCT18J/disaster-notifyをご確認ください．");
        console.log(Array.isArray(config.webhook.to))
        process.exit(1);
    }
})()