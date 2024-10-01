<template>
  <div id="app">
    <canvas ref="threeCanvas"></canvas>
    <!-- ローディングインジケーター -->
    <div v-if="loading" class="loading">
      ローディング中: {{ loadingProgress }}%
    </div>
    <!-- 可愛いボタン -->
    <button class="cute-button" @click="onButtonClick">
      にゃー 推して(ボタン)
    </button>
  </div>
</template>

<script>
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export default {
  name: 'App',
  data() {
    return {
      loading: true,
      loadingProgress: 0,
      sound: null, // 音声データ用
      speechBubble: null,
      isRotating: false,
      rotationProgress: 0,
      rotationSpeed: 0.02, // ラジアン毎フレーム
      scene: null,
      camera: null,
      renderer: null,
      sceneModel: null,
      // メッセージの配列を追加
      messages: [
        "こんにちはー！",
        "元気でた？",
        "今お天気？",
        "ありがとう。",
        "ファイト"
      ],
    };
  },
  mounted() {
    this.initThreeJS();
  },
  methods: {
    initThreeJS() {
      // シーンの作成
      const scene = new THREE.Scene();
      this.scene = scene;

      // 背景色をよりピンク色に設定
      scene.background = new THREE.Color(0xffd1dc); // #ffd1dc は淡いピンク色

      // カメラの設定
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.set(0, 0, 20); // カメラの初期位置
      this.camera = camera;

      // レンダラーの設定
      const renderer = new THREE.WebGLRenderer({
        canvas: this.$refs.threeCanvas,
        antialias: true,
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer = renderer;

      // コントロールの設定
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;

      // ライティングの追加
      const ambientLight = new THREE.AmbientLight(0xffffff, 2); // 明るくする
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 2); // 強めの光
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      // 星空の追加（色調整済み）
      const starGeometry = new THREE.BufferGeometry();
      const starMaterial = new THREE.PointsMaterial({
        color: 0xffccbb, // 淡いオレンジピンク色
        size: 0.5, // 星のサイズを調整
        transparent: true,
        opacity: 0.8, // 少し透過させてマットな感じに
      });
      const starVertices = [];
      for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starVertices.push(x, y, z);
      }
      starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
      const stars = new THREE.Points(starGeometry, starMaterial);
      scene.add(stars); // 調整済みの星空をシーンに追加

      // 音声のループ再生設定
      const listener = new THREE.AudioListener();
      camera.add(listener);

      const sound = new THREE.Audio(listener);
      const audioLoader = new THREE.AudioLoader();
      audioLoader.load('/path_to_audio_file.mp3', (buffer) => {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0.5); // 音量を50%に設定
        sound.play(); // 音声再生開始
      });
      this.sound = sound;

      // GLTFLoaderのインスタンス作成
      const loader = new GLTFLoader();

      // インタラクティブにするモデルの配列
      const interactiveModels = [];

      // scene.glbモデルのロード
      const sceneModelUrl = '/models/scene.glb'; // scene.glb の相対パス
      loader.load(
        sceneModelUrl,
        (gltf) => {
          const sceneModel = gltf.scene;
          scene.add(sceneModel);
          this.sceneModel = sceneModel; // モデルを保存

          // モデルのスケール調整
          const box = new THREE.Box3().setFromObject(sceneModel);
          const maxDim = Math.max(
            box.getSize(new THREE.Vector3()).x,
            box.getSize(new THREE.Vector3()).y,
            box.getSize(new THREE.Vector3()).z
          );
          sceneModel.scale.setScalar(10.5 / maxDim);

          // モデルをシーン内の適切な位置に配置（必要に応じて調整）
          sceneModel.position.set(0, -5, 0); // 中央に配置

          // インタラクティブモデルとして追加
          interactiveModels.push(sceneModel);

          // ローディング完了
          this.loading = false;
        },
        (xhr) => {
          if (xhr.lengthComputable) {
            this.loadingProgress = Math.round((xhr.loaded / xhr.total) * 100);
          }
        },
        (error) => {
          console.error('モデルの読み込み中にエラーが発生しました', error);
          this.loading = false;
        }
      );

      // TransformControlsの設定
      const transformControls = new TransformControls(camera, renderer.domElement);
      scene.add(transformControls);

      // Raycasterとマウスベクターの設定
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      // 選択されたオブジェクトを保持する変数
      let selectedObject = null;

      // マウスクリックイベントのリスナー
      const onMouseDown = (event) => {
        // 正規化デバイス座標 (-1から+1)
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // インタラクティブモデルのみを対象
        const intersects = raycaster.intersectObjects(
          interactiveModels,
          true // 子オブジェクトも含める
        );

        if (intersects.length > 0) {
          // 最も近いオブジェクトを選択
          selectedObject = intersects[0].object.parent; //親オブジェクトを取得

          // TransformControlsに選択されたオブジェクトをアタッチ
          transformControls.attach(selectedObject);
        } else {
          // 何も選択されていない場合、TransformControlsを解除
          transformControls.detach();
        }
      };

      window.addEventListener('mousedown', onMouseDown, false);

      // TransformControlsのイベントリスナー
      transformControls.addEventListener('dragging-changed', (event) => {
        controls.enabled = !event.value; // ドラッグ中はOrbitControlsを無効化
      });

      // アニメーションループの定義
      const animate = () => {
        requestAnimationFrame(animate);

        // 回転処理
        if (this.isRotating && this.sceneModel) {
          const delta = this.rotationSpeed;
          this.sceneModel.rotation.y += delta;
          this.rotationProgress += delta;
          if (this.rotationProgress >= Math.PI * 2) {
            this.isRotating = false;
            this.rotationProgress = 0;
          }
        }

        controls.update(); // コントロールの更新
        transformControls.update(); // TransformControlsの更新
        renderer.render(scene, camera);
      };
      animate();

      // ウィンドウリサイズ時の対応
      window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    },
    // ボタン押下時のハンドラー
    onButtonClick() {
      // ランダムなインデックスを取得
      const randomIndex = Math.floor(Math.random() * this.messages.length);
      const randomMessage = this.messages[randomIndex];
      // ランダムなメッセージを表示
      this.showSpeechBubble(randomMessage);
      this.startRotation();
    },
    // 吹き出しを表示するメソッド
    showSpeechBubble(message) {
      if (this.speechBubble) return; // 既に吹き出しが表示されている場合は無視

      // テキストを描画するためのCanvasを作成
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const fontSize = 64;
      context.font = `Bold ${fontSize}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // テキストの幅と高さを取得
      const textMetrics = context.measureText(message);
      const textWidth = textMetrics.width;
      const textHeight = fontSize; // 簡易的にフォントサイズを高さとする

      // Canvasのサイズをテキストに合わせて設定
      canvas.width = textWidth + 40; // パディングを追加
      canvas.height = textHeight + 40;

      // 再度フォントを設定（サイズ変更に伴うクリア）
      context.font = `Bold ${fontSize}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // テキストの色を青に設定（ボタンと同じ色）
      context.fillStyle = '#00bfff';

      // 背景の描画を削除またはコメントアウト
      // context.fillStyle = 'rgba(0, 0, 0, 0.7)';
      // context.roundRect(20, 20, textWidth, textHeight, 20);
      // context.fill();

      // テキストを描画
      context.fillText(message, canvas.width / 2, canvas.height / 2);

      // CanvasTextureを作成
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      // SpriteMaterialを作成
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMaterial);

      // 吹き出しのサイズを調整
      const maxWidth = 10; // シーン内での最大幅
      const scaleFactor = maxWidth / canvas.width;
      sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1);

      // 吹き出しをモデルの上に配置
      sprite.position.set(0, 10, 0); // 必要に応じて調整

      // 吹き出しをシーンに追加
      this.scene.add(sprite);
      this.speechBubble = sprite;

      // 5秒後に吹き出しを削除
      setTimeout(() => {
        if (this.speechBubble) {
          this.scene.remove(this.speechBubble);
          this.speechBubble = null;
        }
      }, 5000);
    },
    // モデルを回転させるメソッド
    startRotation() {
      if (this.isRotating) return; // 既に回転中の場合は無視
      this.isRotating = true;
      this.rotationProgress = 0;
    },
  },
};

// Canvasのコンテキストに角丸矩形を描画するための拡張（必要であれば残す）
CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
  if (width < 2 * radius) radius = width / 2;
  if (height < 2 * radius) radius = height / 2;
  this.beginPath();
  this.moveTo(x + radius, y);
  this.arcTo(x + width, y, x + width, y + height, radius);
  this.arcTo(x + width, y + height, x, y + height, radius);
  this.arcTo(x, y + height, x, y, radius);
  this.arcTo(x, y, x + width, y, radius);
  this.closePath();
  return this;
};
</script>

<style>
body, html {
  margin: 0;
  overflow: hidden;
  height: 100%;
}

#app {
  position: relative;
  width: 100%;
  height: 100%;
}

canvas {
  display: block;
}

.loading {
  position: absolute;
  top: 10px;
  left: 10px;
  color: white;
  font-family: Arial, sans-serif;
  background: rgba(0, 0, 0, 0.5);
  padding: 5px 10px;
  border-radius: 5px;
}

/* 可愛いボタンのスタイル */
.cute-button {
  position: absolute;
  top: 80%; /* ボタンの位置を画面の70%の高さに設定 */
  left: 50%;
  transform: translate(-50%, -50%); /* ボタンを中央に配置 */
  background-color: #00bfff;
  border: none;
  color: white;
  padding: 20px 30px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 20px;
  font-family: 'Comic Sans MS', cursive, sans-serif;
  border-radius: 50px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.cute-button:hover {
  transform: translate(-50%, -50%) scale(1.1);
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.4);
}

.cute-button:active {
  transform: translate(-50%, -50%) scale(0.95);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
</style>
