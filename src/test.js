const cactusModelUrl = '/models/Cactus1.gltf';


loader.load(
  sampleGlbUrl,
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);

    // モデルのサイズ調整
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2 / maxDim;
    model.scale.setScalar(scale);

    // モデルを中心に配置
    model.position.sub(center.multiplyScalar(scale));

    console.log('サンプル.glbモデルが正常にロードされました');
  },
  (xhr) => {
    console.log(`サンプル.glbロード中: ${(xhr.loaded / xhr.total) * 100}%`);
  },
  (error) => {
    console.error('サンプル.glbモデルの読み込み中にエラーが発生しました', error);
  }
);
