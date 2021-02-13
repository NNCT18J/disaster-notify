# disaster-notify
地震を観測したらDiscordにPOSTします．

# config.json
最初に作成してください．
```json
{
    "importantArea" : "{警告する都市(例: 東京)}",
    "webhook": {
        "to": "DiscordのWebhook URL"
    }
}

# 実行
1. `git clone https://github.com/NNCT18J/disaster-notify.git`
1. `cd disaster-notify`
1. `npm i`
1. `node app`


```

# 通知例

- `importantArea`に設定されていた場合

![warning](https://imgur.com/PVfwzyI.png)

- それ以外

![caution](https://imgur.com/gPljc5b.png)

# データ元
ありがとうございます．

- ## [JSON API P2P地震情報 ガラクタおきば](https://www.p2pquake.net/dev/json-api/)