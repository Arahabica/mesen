# 目線入れ (Mesen)

画像に目隠し用の線を入れることに特化したシンプルなWebアプリケーション

![ogp](./public/ogp.png)

## 概要

「目線入れ」は、写真や画像に黒い線を描画して、プライバシー保護のための目隠しを簡単に追加できるWebアプリケーションです。Next.jsを使用して構築され、ブラウザ上で完結するため、画像データがサーバーに送信されることはありません。

## 主な機能

- 📸 **画像アップロード**: ローカルから画像を選択
- ✏️ **線の描画**: 長押し＋ドラッグで黒い線を描画
- 🔧 **線の太さ調整**: 6段階の太さ（2px, 5px, 10px, 20px, 40px, 60px）
- 🔍 **拡大・縮小**: マウスホイールやピンチ操作で画像をズーム
- 🚀 **ドラッグ移動**: 画像の位置を自由に調整
- ↩️ **元に戻す**: 描画した線を1つずつ取り消し
- 💾 **ダウンロード**: 編集後の画像をPNG形式で保存
- 📱 **レスポンシブ対応**: PC・タブレット・スマートフォンに対応

## 使い方

1. **画像の選択**
   - 「画像を選択する」ボタンをクリック
   - ローカルから画像ファイルを選択

2. **線の描画**
   - マウス/タッチを長押し（0.5秒）してから移動すると線を描画
   - 線の太さは左上に表示

3. **線の太さ変更**
   - 描画した線をクリック/タップすると太さが順番に変更

4. **画像の操作**
   - ドラッグで画像を移動
   - マウスホイール/ピンチで拡大・縮小

5. **編集の完了**
   - 「ダウンロード」ボタンで画像を保存
   - 右上の「×」ボタンで編集を終了

## 技術スタック

- **フレームワーク**: Next.js 14.2.3
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **UI**: React 18
- **ビルドツール**: Next.js (SSG)
- **デプロイ**: Vercel

## セットアップ

### 必要な環境
- Node.js 18以上
- npm または yarn

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/Arahabica/mesen.git
cd mesen

# 依存関係のインストール
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く

### ビルド

```bash
npm run build
```

### デプロイ

```bash
npm run deploy
```

## プロジェクト構成

```
mesen/
├── app/                   # Next.js App Router
│   ├── globals.css       # グローバルスタイル
│   ├── layout.tsx        # レイアウトコンポーネント
│   └── page.tsx          # メインページ
├── components/           # Reactコンポーネント
│   └── ImageEditor.tsx   # 画像編集コンポーネント
├── public/               # 静的ファイル
│   ├── favicon.png       # ファビコン
│   └── ogp.png          # OGP画像
├── package.json          # プロジェクト設定
├── tailwind.config.ts    # Tailwind CSS設定
├── tsconfig.json         # TypeScript設定
└── vercel.json          # Vercel設定
```

## 開発コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバーの起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバーの起動 |
| `npm run lint` | ESLintの実行 |
| `npm run deploy` | Vercelへのデプロイ |

## プライバシー

- すべての画像処理はブラウザ内で完結
- サーバーへの画像アップロードは行われません
- 個人情報の収集は一切ありません

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 作者

- GitHub: [@Arahabica](https://github.com/Arahabica)

## 貢献

Issue や Pull Request は歓迎します。大きな変更を行う場合は、まず Issue を作成して変更内容について議論してください。