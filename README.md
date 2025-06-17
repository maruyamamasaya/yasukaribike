# yasukaribike  
yasukari専用 / For Yasukari Internal Use

---

## 🖥️ サンプルフロントエンド  
## 🖥️ Sample Frontend

`web` ディレクトリに簡易的な顧客管理画面のサンプルを置いています。  
You can find a simple customer management UI sample in the `web` directory.

`index.html` をブラウザで開くと、検索付きの一覧表示・追加・編集フォームが利用可能です。  
Open `index.html` in a browser to use a searchable table and forms for adding/editing customers.

Bootstrap を利用しているため、見た目もある程度整っています。
It uses Bootstrap for basic styling and layout.

メールカテゴリの一覧は `/categories` API から取得し、トップページで自動表示されます。各カテゴリの件数も横に表示されます。
The category list on the top page is now populated automatically via the `/categories` API, and each category shows its entry count.

新規追加時には履歴メモを入力でき、編集画面では登録済みの履歴を確認できます。  
You can input notes when adding new entries, and view the saved history in the edit form.

顧客テーブルとフォームの電話項目は「電話番号（Phone Number）」と表記されています。  
The phone number field is labeled as "電話番号 (Phone Number)" in the table and form.

## 📖 操作マニュアル / User Manual

画面の使い方や検索方法をまとめた `manual.html` を `web` ディレクトリに追加しました。
The `web` directory now contains `manual.html` explaining how to operate each screen and how to search.

最新版では目次とインデックスを備え、項目間を簡単に行き来できます。
The latest manual includes a table of contents and an index for easier navigation.

トップページ (`index.html`) 上部のリンクから参照できます。
You can access it from the link at the top of `index.html`.


---

## 🔗 API 接続設定 / API Configuration

バックエンドの API エンドポイントは `web/app.js` の `API` 定数で設定してください。
Set the API endpoint in the `API` constant in `web/app.js`.

`search.js` や `detail.js` にも同様に記述が必要です。
You also need to set the same endpoint in `search.js` and `detail.js`.

以前は 3 つのファイルすべてで `API = 'http://localhost:3000'` と指定していましたが、
現在は `window.location.origin` を利用して自動的にホストを判定するようになっています。
The sample code previously set `API = 'http://localhost:3000'` in all three files,
but now it uses `window.location.origin` so the host is detected automatically.

---

## 📊 画面のポイント / UI Features

### ✅ ダッシュボード指標 / Dashboard Metrics
- **総問い合わせ / Total Inquiries**: 顧客データの総件数 / Total customer entries (links to `all.html`)
- **本日の件数 / Today’s Count**: Entries where `date` equals today
- **本日の電話対応 / Today’s Phone Calls**: Today's entries with `category` = "電話" (`phone_today.html`)
- **訪問対応一覧 / Today’s Visits**: Today's entries with `category` = "訪問対応" (`visit_today.html`)
- **未完了 / Pending**: Entries with `status` not equal to `完了`

### 🔁 ページネーション / Pagination  
一覧下部の「前へ」「次へ」ボタンでページ移動ができます。  
You can navigate pages using "Previous" / "Next" buttons at the bottom.  
中央には `現在のページ / 総ページ数` を表示します。  
The current page and total pages are shown in the center.

### 🔍 詳細ページ / Detail View  
各行の「詳細」リンクで `detail.html` を表示します。  
Clicking "詳細" (Detail) opens `detail.html`,  
`detail.js` が API からデータを取得して表示します。  
which fetches and shows customer details via `detail.js`.

---

## 🚀 サーバーの起動 / Starting the Server (Express)

Node.js + Express を使ってサーバーを起動する手順：
Steps to start the server using Node.js and Express:

AWS SDK を利用するため `AWS_REGION` を設定します (例: `ap-northeast-1`)。
Set `AWS_REGION` for the AWS SDK (e.g., `ap-northeast-1`).

### 必要な環境変数 / Required Environment Variables
- **BASIC_USER / BASIC_PASS**: ベーシック認証のユーザー名とパスワード / Basic auth credentials
- **EMAIL_USER / EMAIL_PASS**: メール取得用 IMAP アカウント / IMAP login for email
- **IMAP_HOST / IMAP_PORT**: IMAP サーバーのホスト名とポート / IMAP server host and port
 - **TABLE_NAME**, **GOOBIKE_TABLE**, **MAIL_TABLE**: 利用する DynamoDB テーブル名 / DynamoDB table names
- **AWS_REGION**: AWS SDK が利用するリージョン / AWS region used by the SDK

これらは `.env` ファイルまたは環境変数として設定してください。 / Add these values in a `.env` file or export them.
`.env.example` に典型的な値のサンプルを用意しています。 / See `.env.example` for typical values.
値が不足していると `/api/fetch-email` などのエンドポイントは 500 エラーを返します。
Missing values will cause endpoints such as `/api/fetch-email` to return 500 errors.

`/api/fetch-email` will read all matching messages from the last two months and
save them in DynamoDB. If an email with the same inquiry number already exists,
the record is updated with the latest details instead of creating a suffixed
duplicate. The endpoint now searches for the pattern `[UB` in the subject line so that
replies and forwarded messages with the same inquiry ID are also captured.


```bash
npm install
export AWS_REGION=ap-northeast-1
npm start
```
グーバイクお客様センター (<goobike_reserve@goobike.com>) から届いたメールをすべて取得したい場合は次のスクリプトを実行できます。
このコマンドは IMAP 上のすべてのフォルダーを自動的に巡回します。
You can fetch every message from `goobike_reserve@goobike.com` via IMAP with the
following command:

```bash
npm run fetch-all
```
実行中はスピナーと件数表示で進捗が確認できます。
While running, a spinner shows progress as each mail is downloaded.
取得状況は `fetchAllEmails.log` にも記録されます。
A log of the operation is appended to `fetchAllEmails.log`.

このスクリプトは IMAP 上のすべてのフォルダーを自動的に巡回し、保存します。各レコードにはフォルダー名およびカテゴリが含まれます。
`INBOX.Junk` と `INBOX.Trash` は自動的に除外され、2025 年 6 月以降に受信したメールのみが対象となります。

Node.js 18 以上を使用してください。アプリはグローバル `fetch` API に依存します。古い Node.js を利用する場合は `node-fetch` などのポリフィルが必要です。
Use Node.js 18 or later because the app relies on the global `fetch` API. Older Node versions require a fetch polyfill such as `node-fetch`.
アプリは起動時に `EMAIL_USER`、`EMAIL_PASS`、`IMAP_HOST` を確認し、不足しているとエラーで停止します。
The application checks `EMAIL_USER`, `EMAIL_PASS`, and `IMAP_HOST` on startup. Missing values throw an error and stop the server.
サーバーは `server.js` で `process.env.PORT || 3000` を使用して起動します。
The server starts on `process.env.PORT || 3000` in `server.js`.

ブラウザで http://54.95.8.178:3000/ にアクセスしてください。  
Access the server at http://54.95.8.178:3000/ in your browser.

フロントエンドは `window.location.origin` を利用して API に接続します。  
The frontend uses `window.location.origin` to connect to the API.

そのため、`index.html` を同じホスト・ポートで開くか、`API_URL` を設定してください。  
So open `index.html` from the same host and port, or define `API_URL`.

データは DynamoDB テーブル `kokyakukanri_TBL` に保存されます。
Customer data is stored in the DynamoDB table `kokyakukanri_TBL`.

### DynamoDB Table Schema

| Field      | Description                                  | Example                           |
|------------|----------------------------------------------|-----------------------------------|
| `order_id` | Partition key, format `YYYYMMDDHHMMSS-XXXX`   | `20240101123000-abcd`             |
| `status`   | Inquiry status (`未着手`, `進行中`, `完了`) | `未着手`                            |
| `email`    | Customer email address                        | `user@example.com`                |
| `name`     | Customer name                                 | `Yamada Taro`                     |
| `type`     | Inquiry source (バイク王, 電話, 訪問受付 など) | `電話`                            |
| `details`  | Inquiry details                               | `故障の相談`                      |
| `date`     | Handled date in `yyyy/mm/dd`                  | `2024/01/01`                      |
| `staff`    | Person in charge                              | `佐藤`                             |
| `phone`    | Phone number                                  | `090-1234-5678`                   |
| `history`  | Notes history object (`YYYY-MM-DD`: text)     | `{ "2024-01-01": "First call" }` |


---

## ☁️ AWS Lambda デプロイ / Deploying to AWS Lambda

Serverless Framework を使って AWS Lambda へデプロイできます。
You can deploy the API to AWS Lambda using the Serverless Framework.

```bash
npm install
npm run deploy
```

`lambda.js` がエクスポートする `handler` を呼び出して API Gateway からアクセスします。
API Gateway triggers the `handler` exported from `lambda.js`.


## 🧠 AI要約サンプル / AI Summary Sample

`/summary` エンドポイントで本日の未完了タスクを取得し、OpenAI API を用いて要約文を返します。
環境変数 `OPENAI_API_KEY` に API キーを設定してください。
このサンプルでは最も低コストな `gpt-3.5-turbo-0125` モデルを使用します。
トップページの「AI要約」ボタンから呼び出し、結果をダイアログ表示します。

要約には各タスクの本文と直近のメモが含まれ、AI へのプロンプトでもその旨を明記しています。
The summary now includes each task's main text and latest note, and the AI prompt explicitly states this.
