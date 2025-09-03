#!/usr/bin/env python3
"""
自动下载 Step-Audio2-Mini2 模型
"""

import os
import sys
import requests
import tqdm
from pathlib import Path

# 配置
MODEL_NAME = "step-audio2-mini2"
MODEL_URL = "https://huggingface.co/stepfun-ai/Step-Audio2-Mini2/resolve/main/step-audio2-mini2.pt"

def download_file(url, destination):
    """下载文件并显示进度条"""
    try:
        # 创建目录
        destination.parent.mkdir(parents=True, exist_ok=True)
        
        # 检查文件是否已存在
        if destination.exists():
            size = destination.stat().st_size
            print(f"✅ 文件已存在: {destination}")
            print(f"大小: {size / (1024*1024*1024):.2f} GB")
            return True
        
        print(f"📥 开始下载: {MODEL_NAME}")
        print(f"来源: {url}")
        print(f"目标: {destination}")
        
        # 发送请求
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # 获取文件总大小
        total_size = int(response.headers.get('content-length', 0))
        
        # 下载文件
        with open(destination, 'wb') as f, tqdm.tqdm(
            desc=f"下载 {MODEL_NAME}",
            total=total_size,
            unit='B',
            unit_scale=True,
            unit_divisor=1024,
        ) as pbar:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))
        
        size = destination.stat().st_size
        print(f"\n✅ 下载完成!")
        print(f"文件大小: {size / (1024*1024*1024):.2f} GB")
        print(f"保存位置: {destination}")
        return True
        
    except Exception as e:
        print(f"\n❌ 下载失败: {e}")
        if destination.exists():
            destination.unlink()  # 删除未完成的文件
        return False

def main():
    print("🎤 Step-Audio2-Mini2 自动下载器")
    print("=" * 50)
    
    # 确定模型路径
    script_dir = Path(__file__).parent
    model_dir = script_dir / "Step-Audio2" / "models"
    model_path = model_dir / f"{MODEL_NAME}.pt"
    
    print(f"模型路径: {model_path}")
    print()
    
    # 下载模型
    success = download_file(MODEL_URL, model_path)
    
    if success:
        print("\n🎉 模型下载成功!")
        print("\n下一步操作:")
        print("1. 启动 TTS 服务:")
        print("   ./start-step-audio2-mac.sh")
        print("2. 在游戏中启用解说和 Step-Audio2")
    else:
        print("\n❌ 下载失败")
        print("请检查网络连接或手动下载")
        print(f"下载地址: {MODEL_URL}")

if __name__ == "__main__":
    main()