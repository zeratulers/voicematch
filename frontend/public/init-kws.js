// 全局KWS初始化脚本
// 在页面加载时预加载KWS相关脚本

console.log('🚀 开始全局KWS初始化...');

// 设置Module配置
window.Module = {};

window.Module.locateFile = function(path) {
  if (path.endsWith('.data') || path.endsWith('.wasm')) {
    console.log('🔍 定位文件:', path);
    return '/wasm/' + path;
  }
  return path;
};

window.Module.onRuntimeInitialized = function() {
  console.log('✅ 全局WASM运行时初始化完成');
  
  // 完全按照原始示例 - 立即创建一个测试实例来验证
  if (window.createKws) {
    try {
      // 像原始示例一样，只传Module参数
      const testRecognizer = window.createKws(window.Module);
      console.log('✅ 全局KWS测试实例创建成功:', testRecognizer);
      
      // 立即释放测试实例
      if (testRecognizer && testRecognizer.free) {
        testRecognizer.free();
      }
      
      // 标记KWS已准备好
      window.KWS_READY = true;
      
      // 触发自定义事件，通知React组件
      window.dispatchEvent(new CustomEvent('kws-ready'));
      console.log('🎉 全局KWS完全可用并已验证');
    } catch (error) {
      console.error('❌ 全局KWS测试失败:', error);
    }
  } else {
    console.error('❌ createKws函数不存在');
  }
};

// 加载KWS脚本
function loadKWSScripts() {
  // 加载sherpa-onnx-kws.js
  const script1 = document.createElement('script');
  script1.src = '/wasm/sherpa-onnx-kws.js';
  script1.async = false;
  script1.onload = () => {
    console.log('✅ 全局加载sherpa-onnx-kws.js成功');
    
    // 加载sherpa-onnx-wasm-kws-main.js
    const script2 = document.createElement('script');
    script2.src = '/wasm/sherpa-onnx-wasm-kws-main.js';
    script2.async = false;
    script2.onload = () => {
      console.log('✅ 全局加载sherpa-onnx-wasm-kws-main.js成功');
    };
    script2.onerror = () => {
      console.error('❌ 全局加载sherpa-onnx-wasm-kws-main.js失败');
    };
    document.head.appendChild(script2);
  };
  script1.onerror = () => {
    console.error('❌ 全局加载sherpa-onnx-kws.js失败');
  };
  document.head.appendChild(script1);
}

// 页面加载完成后开始加载KWS
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadKWSScripts);
} else {
  loadKWSScripts();
}
