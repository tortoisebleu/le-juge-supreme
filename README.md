# Le Juge Suprême 🍴⚖️

レシートを撮影するだけで、食費とカロリーを自動記録するGoogle Apps Scriptアプリです。

## 必要なもの
- Googleアカウント
- Gemini APIキー（Google AI Studioで取得）
- Googleスプレッドシート（シート名：`家計簿`、`設定`）
- Google Drive フォルダ（保存先）

## セットアップ方法
1. GASのスクリプトプロパティに `GEMINI_API_KEY` を設定
2. `Code.gs` の `SAVE_FOLDER_ID` にGoogle DriveのフォルダIDを入力
3. `Code.gs` の `modelName` を自分の環境に合わせて変更

## 使い方
1. レシートの写真をアップロード
2. 「Ouvrir le procès !」ボタンを押す
3. 結果を確認！

## 月次レポート
- 「Bilan du mois」で今月の集計
- 「Mois dernier」で先月の集計
- 総カロリーと AIによるアドバイスを表示
