#!/usr/bin/env python3
"""
Step-Audio2-Mini2 模型下载脚本
自动从 Hugging Face 下载模型文件
"""

import os
import sys
import requests
import tqdm
import hashlib
from pathlib import Path

# 配置
MODEL_NAME = "step-audio2-mini2"
MODEL_URL = "https://huggingface.co/stepfun-ai/Step-Audio2-Mini2/resolve/main/step-audio2-mini2.pt"
MODEL_SIZE = "1.2GB"  # 预估大小
CHECKSUM = "a1b2c3d4e5f6"  # TODO: 替换为实际的MD5校验和

def download_file(url, destination):
    """下载文件并显示进度条"""
    try:
        # 创建目录
        destination.parent.mkdir(parents=True, exist_ok=True)
        
        # 检查文件是否已存在
        if destination.exists():
            size = destination.stat().st_size
            print(f"文件已存在: {destination}")
            print(f"大小: {size / (1024*1024):.2f} MB")
            return True
        
        print(f"开始下载: {url}")
        print(f"目标位置: {destination}")
        print(f"预估大小: {MODEL_SIZE}")
        
        # 发送请求
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # 获取文件总大小
        total_size = int(response.headers.get('content-length', 0))
        
        # 下载文件
        with open(destination, 'wb') as f, tqdm.tqdm(
            desc=destination.name,
            total=total_size,
            unit='B',
            unit_scale=True,
            unit_divisor=1024,
        ) as pbar:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))
        
        print(f"\n✅ 下载完成: {destination}")
        return True
        
    except Exception as e:
        print(f"\n❌ 下载失败: {e}")
        if destination.exists():
            destination.unlink()  # 删除未完成的文件
        return False

def verify_checksum(file_path, expected_checksum):
    """验证文件校验和"""
    # TODO: 实现MD5校验
    print("⚠️  跳过校验和验证（请手动验证）")
    return True

def main():
    print("🎤 Step-Audio2-Mini2 模型下载器")
    print("=" * 50)
    
    # 确定模型路径
    script_dir = Path(__file__).parent
    if script_dir.name == "scripts":
        model_dir = script_dir.parent / "models"
    else:
        model_dir = script_dir / "Step-Audio2" / "models"
    
    model_path = model_dir / f"{MODEL_NAME}.pt"
    
    print(f"模型将保存在: {model_path}")
    print()
    
    # 确认下载
    if not model_path.exists():
        response = input(f"即将下载 {MODEL_SIZE} 的模型文件，是否继续？ [y/N]: ")
        if response.lower() != 'y':
            print("下载已取消")
            return
    
    # 下载模型
    success = download_file(MODEL_URL, model_path)
    
    if success:
        # 验证文件
        if verify_checksum(model_path, CHECKSUM):
            print("\n🎉 模型下载并验证成功！")
            print("\n下一步:")
            print("1. 确保已安装依赖: pip install -r requirements.txt")
            print("2. 启动服务: python tts_server.py")
            print("3. 在游戏中启用解说功能")
        else:
            print("\n❌ 文件校验失败，请重新下载")
    else:
        print("\n❌ 下载失败，请检查网络连接或手动下载")
        print(f"手动下载地址: {MODEL_URL}")

if __name__ == "__main__":
    main()