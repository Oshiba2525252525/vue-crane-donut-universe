<template>
  <div id="app">
    <canvas ref="threeCanvas"></canvas>
    <!-- ローディングインジケーター -->
    <div v-if="loading" class="loading">
      ローディング中: {{ loadingProgress }}%
    </div>
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
    };
  },
  mounted() {
    this.initThreeJS();
  },
  methods: {
    initThreeJS() {
      // シーンの作成
      const scene = new THREE.Scene();

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

      // レンダラーの設定
      const renderer = new THREE.WebGLRenderer({
        canvas: this.$refs.threeCanvas,
        antialias: true,
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);

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

      /* 
      // トーラス（ドーナツ）の作成
      const torusGeometry = new THREE.TorusGeometry(2.5, 0.75, 16, 100);
      const torusMaterial = new THREE.MeshStandardMaterial({
        color: 0x1E90FF, // 神秘的な青色
        metalness: 0.8,  // 金属感
        roughness: 0.3,  // 表面の粗さ
      });
      const torus = new THREE.Mesh(torusGeometry, torusMaterial);
      scene.add(torus);
      */

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
        },
        (xhr) => {
          if (xhr.lengthComputable) {
            this.loadingProgress = Math.round((xhr.loaded / xhr.total) * 100);
          }
        },
        (error) => {
          console.error('scene.glbモデルの読み込み中にエラーが発生しました', error);
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
          selectedObject = intersects[0].object.parent; // 親オブジェクトを取得

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

        /*
        // トーラスを回転させる
        torus.rotation.x += 0.005;
        torus.rotation.y += 0.01;
        */

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
  },
};
</script>

<style>
body, html {
  margin: 0;
  overflow: hidden;
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
</style>
