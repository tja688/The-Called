# The Called

Vite + React + TypeScript + Three.js（React Three Fiber）基础工程，不含玩法或内容。

## 运行

```bash
npm install
npm run dev
```

浏览器打开终端里给出的本地地址即可。拖拽可旋转视角，滚轮缩放。

## 结构

```text
src/
  main.tsx            入口
  App.tsx             挂载 Canvas
  scene/Experience.tsx 灯光、占位几何体、轨道控制
  styles/global.css   全屏画布重置
public/
  favicon.svg
```

新游戏的文档、规则和资源导入后，从 `src/scene` 往外长即可。
