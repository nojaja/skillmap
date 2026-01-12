// テスト環境のセットアップ
// BroadcastChannelをテスト環境で無効化してJestがクリーンに終了できるようにする
global.BroadcastChannel = undefined as any
