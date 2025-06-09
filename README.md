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

新規追加時には履歴メモを入力でき、編集画面では登録済みの履歴を確認できます。  
You can input notes when adding new entries, and view the saved history in the edit form.

顧客テーブルとフォームの電話項目は「電話番号（Phone Number）」と表記されています。  
The phone number field is labeled as "電話番号 (Phone Number)" in the table and form.

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
- **総問い合わせ / Total Inquiries**: 顧客データの総件数 / Total customer entries  
- **本日の件数 / Today’s Count**: Entries where `date` equals today
- **未済 / Pending**: Entries with `status` = "未済" (unresolved)

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

```bash
npm install
export AWS_REGION=ap-northeast-1
npm start
```
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
| `status`   | Inquiry status ("済" or "未済" etc.)        | `未済`                            |
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




