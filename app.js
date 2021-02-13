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
    console.log(JSON.stringify(json, null, 2));
    request({ url: config.webhook.to, method: "POST", json }, (error, response, body) => {
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
    return true;
}

const job = () => {
    request({ url: `https://api.p2pquake.net/v1/human-readable?limit=3`, headers: { 'User-Agent': 'nnct3j-bot' } }, (error, response, body) => {
        let data = JSON.parse(response.body);
        data.forEach(data => data.time = moment(data.time.split("/").join("-")));
        const dataFromKisho = data.filter(obj => obj.code === 551).filter(obj => obj.earthquake.maxScale >= 30);
        const dataFast = data.filter(obj => obj.code === 5610)
        if (dataFromKisho.some(obj => obj.time > bufDate)) {
            const data = dataFromKisho.find(obj => obj.time > bufDate);
            //const data = dataFromKisho[1];
            const isDanger = data.points.some(point => point.addr.indexOf(config.importantArea) !== -1);
            if (discordPost({
                "username": "緊急地震速報",
                "avatar_url": (isDanger) ? "https://cdn1.iconfinder.com/data/icons/color-bold-style/21/08-512.png" : "https://cdn.iconscout.com/icon/free/png-256/warning-notice-sign-symbol-38020.png",
                "content": `${((isDanger) ? `@everyone **${config.importantArea}での震度は${(shindo[data.points.find(point => point.addr.indexOf(config.importantArea) !== -1).scale])}**` : "")} **地震です: 気象庁の発表 **`,
                "embeds": [
                    {
                        "title": `気象庁より地震速報がありました`,
                        "description": `${data.earthquake.time}ごろ地震がありました．`
                            + (isDanger ? `**${config.importantArea}での震度は${(shindo[data.points.find(point => point.addr.indexOf(config.importantArea) !== -1).scale])}です．落ち着いて，身を守る行動を取ってください．みんなで生き残ろう．**`
                                : `${config.importantArea}への影響はありませんでした．`),
                        "timestamp": moment().utc(),
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
                                t.addr.push(c.addr);
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
                        })))
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
})()