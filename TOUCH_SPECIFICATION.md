# タッチ操作仕様書

## 概要

このドキュメントは、目線入れアプリのタッチ操作における詳細な仕様を定義します。

## モード一覧

| モード | 英名 | 説明 |
|--------|------|------|
| 初期状態 | `none` | タッチ開始直後の判定待ち状態 |
| 移動モード | `move` | 画像のパン・ズーム操作 |
| 調整モード | `adjust` | ルーペ表示による位置調整 |
| 描画モード | `draw` | 実際の線描画 |
| 線移動モード | `moveLine` | 既存の線の移動 |

## タッチ操作フロー

### 🟦 1. タッチ開始

指が画面に触れると、モードは `none` になり、100ms間の判定期間に入ります。

### 🟩 2. 位置による分岐判定

タッチ位置が既存の黒線に対してどこにあるかで処理が分岐します。

#### 📏 判定基準
- **線に近い**: 線の中心、または線から25px以内
- **線から遠い**: 線から25px以上離れている

---

## 🔴 線に近い場合の処理

### ⏱️ 100ms判定期間

| 条件 | 結果 |
|------|------|
| 100ms以内に指を離す | **黒線タップ** → 線の太さ変更 |
| 100ms経過後も指が画面上 | **線移動モード**に移行 |

### 📦 線移動モード (`moveLine`)

- ✅ ルーペが表示される
- ✅ 指の移動に合わせて線が移動
- ✅ 指を離すと移動完了

---

## 🔵 線から遠い場合の処理

### ⏱️ 100ms判定期間

100ms間の指の移動量を監視し、モードを決定します。

#### 🎯 判定基準

| 移動量 | モード | 説明 |
|--------|--------|------|
| 3px以上 | **移動モード** | 画像のドラッグ開始 |
| 3px未満 | **調整モード** | ルーペ表示開始 |
| 指を離す | **タップ** | ダブルタップ判定へ |

### 🟢 移動モード (`move`)

#### 動作
- 🖱️ **ドラッグ**: 画像位置を調整
- 🔒 **排他制御**: 指を離すまで他モードに移行しない
- 🔄 **終了**: 指を離すと `none` に戻る

### 🟡 調整モード (`adjust`)

#### 🔍 ルーペ表示
- 指の位置にルーペが表示される
- ルーペは指の移動に追従する
- ルーペ内に描画予定の線の太さが表示される

#### ⏰ 1秒静止判定
- **静止判定**: 指の移動が1px以下/フレーム
- **カウントダウン**: 静止開始から0.35秒後に白いボーダーアニメーション開始
- **モード移行**: 1秒間静止すると**描画モード**に移行

#### 🔀 早期移行（200ms以内）
調整モード開始から200ms以内に6px以上移動すると**移動モード**に切り替わります。

### 🔴 描画モード (`draw`)

#### 🎨 線描画
- ✅ ルーペは継続表示
- ✅ ペンアイコンが一時的に表示
- ✅ 中心円がスケールアニメーション
- ✅ 指の移動で線を描画
- ✅ 指を離すと線が確定

### 👆 タップ処理

#### 🔄 ダブルタップ判定
- **判定条件**: 300ms以内 & 30px以内の連続タップ
- **ズーム動作**:
  - 初期スケール時 → 2.5倍ズーム（タップ位置中心）
  - 拡大時 → 初期スケールに戻る

---

## ⚙️ 技術仕様

### 📊 定数値

| 定数 | 値 | 説明 |
|------|---|------|
| `CLICK_DISTANCE_THRESHOLD` | 3px | タップ判定の移動閾値 |
| `LINE_HIT_EXPANSION` | 25px | 線のタップ判定範囲 |
| `ADJUST_MODE_DELAY` | 200ms | 調整→移動モード切替猶予 |
| `DRAW_MODE_DELAY` | 1000ms | 調整→描画モード移行時間 |
| `DOUBLE_TAP_ZOOM_FACTOR` | 2.5 | ダブルタップズーム倍率 |

### 🎯 ルーペ仕様

- **サイズ**: 直径100px（半径50px）
- **拡大率**: 現在のズーム × 1.5倍
- **位置**: 画面端を避けて動的配置
- **視覚効果**: 
  - 調整モード: 半透明中心円 + 白ボーダーアニメーション
  - 描画モード: 不透明中心円 + ペンアイコン + スケールアニメーション

---

## 🔄 モード遷移図

```
none
├── 線に近い
│   ├── 100ms以内離す → タップ（太さ変更）
│   └── 100ms経過 → moveLine
└── 線から遠い
    ├── 3px以上移動 → move
    ├── 3px未満 → adjust
    │   ├── 200ms以内6px移動 → move
    │   └── 1秒静止 → draw
    └── 100ms以内離す → タップ
        └── ダブルタップ判定 → ズーム
```

## 📱 ユーザー体験

1. **直感的操作**: 自然な指の動きでモードが自動判定
2. **精密描画**: ルーペによる正確な位置指定
3. **誤操作防止**: 適切な判定時間と閾値設定
4. **視覚フィードバック**: アニメーションによる状態表示