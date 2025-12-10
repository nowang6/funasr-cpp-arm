# FunASR C++

FunASR（基础语音识别）系统的C++实现，提供自动语音识别（ASR）功能，支持离线和在线/流式处理。基于ONNX Runtime实现高效的模型推理。

## 项目概述

FunASR C++是一个高性能的语音识别引擎，支持：
- **离线ASR** - 音频文件的批量处理
- **在线/流式ASR** - 实时音频处理
- **双通ASR** - 结合流式和离线处理的混合方法
- **语音活动检测（VAD）** - 自动语音分段
- **标点恢复** - 文本后处理以提高可读性

## 快速开始

### 安装依赖
```bash
sudo yum -y install openblas-devel openssl-devel
```


### 下载三方库
```bash
cd third_party
wget https://isv-data.oss-cn-hangzhou.aliyuncs.com/ics/MaaS/ASR/dep_libs/onnxruntime-linux-x64-1.14.0.tgz
tar -zxvf onnxruntime-linux-aarch64-1.14.0.tgz
wget https://isv-data.oss-cn-hangzhou.aliyuncs.com/ics/MaaS/ASR/dep_libs/ffmpeg-master-latest-linuxarm64-gpl-shared.tar.xz
tar -xvf ffmpeg-master-latest-linux64-gpl-shared.tar.xz
```

### 编译
```bash
mkdir build
cd build
cmake -DCMAKE_BUILD_TYPE=release ..
make -j16

cp bin/funasr-wss-server-2pass ../
cp bin/funasr-wss-client-2pass ../
```

### 测试

#### 服务器端
```bash
./funasr-wss-server-2pass \
  --download-model-dir "models" \
  --model-dir "models/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-onnx" \
  --online-model-dir "models/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online-onnx" \
  --vad-dir "models/speech_fsmn_vad_zh-cn-16k-common-onnx" \
  --punc-dir "models/punc_ct-transformer_zh-cn-common-vad_realtime-vocab272727-onnx" \
  --itn-dir "models/fst_itn_zh" \
  --lm-dir "models/speech_ngram_lm_zh-cn-ai-wesp-fst" \
  --decoder-thread-num 32 \
  --model-thread-num 1 \
  --io-thread-num 2 \
  --port 10095
```

#### 客户端
```bash
./funasr-wss-client-2pass --server-ip 127.0.0.1 --port 10095 --wav-path data/张三丰.wav --is-ssl 0
```

## 目录结构

```
funasr-cpp/
├── README.md                    # 本文档
├── CMakeLists.txt              # 主CMake构建配置
├── hotwords.txt                # ASR热词配置
├── .gitignore                  # Git忽略模式
│
├── onnxruntime/                # 核心实现
│   ├── src/                    # 主C++源文件
│   │   ├── paraformer.cpp      # Paraformer ASR模型
│   │   ├── paraformer-online.cpp  # 流式Paraformer
│   │   ├── sensevoice-small.cpp   # SenseVoice ASR模型
│   │   ├── fsmn-vad.cpp        # 语音活动检测
│   │   ├── fsmn-vad-online.cpp # 流式VAD
│   │   ├── ct-transformer.cpp  # 标点模型
│   │   ├── audio.cpp           # 音频处理工具
│   │   ├── resample.cpp        # 音频重采样
│   │   ├── util.cpp            # 通用工具
│   │   ├── vocab.cpp           # 词汇表管理
│   │   ├── tokenizer.cpp       # 文本分词
│   │   ├── wfst-decoder.cpp    # 基于WFST的解码
│   │   ├── offline-stream.cpp  # 离线处理流
│   │   └── tpass-stream.cpp    # 双通流式处理
│   ├── include/                # 公共API头文件
│   │   ├── funasrruntime.h     # 主ASR API
│   │   ├── audio.h             # 音频处理API
│   │   ├── model.h             # 模型接口
│   │   └── offline-stream.h    # 流处理API
│   └── third_party/            # 嵌入式依赖
│       ├── glog/               # Google日志库
│       ├── gflags/             # 命令行解析
│       ├── kaldi/              # 语音识别工具包
│       ├── openfst/            # 有限状态转换器
│       ├── yaml-cpp/           # YAML配置解析
│       ├── jieba/              # 中文文本分词
│       └── kaldi-native-fbank/ # 特征提取
│
├── bin/                        # 可执行应用程序
│   ├── funasr-wss-server.cpp      # Websocket服务器
│   ├── funasr-wss-server-2pass.cpp # 双通流式服务器
│   ├── funasr-wss-client.cpp      # Websocket客户端
│   ├── funasr-wss-client-2pass.cpp # 双通流式客户端
│   └── microphone.cpp          # 音频捕获工具
│
├── models/                     # 预训练ONNX模型
│   └── damo/                   # 阿里巴巴达摩院模型
│       ├── speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-onnx/
│       ├── speech_fsmn_vad_zh-cn-16k-common-onnx/
│       ├── punc_ct-transformer_zh-cn-common-vad_realtime-vocab272727-onnx/
│       └── speech_ngram_lm_zh-cn-ai-wesp-fst/
│
├── third_party/                # 外部依赖
│   ├── asio/                   # 异步I/O库
│   ├── websocket/              # Websocket协议实现
│   ├── json/                   # JSON解析库
│   ├── ffmpeg/                 # 音频/视频处理
│   └── onnxruntime/            # ONNX模型推理运行时
│
└── build/                      # 构建输出目录
    ├── funasr-wss-server       # 编译后的服务器可执行文件
    ├── funasr-wss-client       # 编译后的客户端可执行文件
    └── lib/                    # 编译后的库文件
```

## 核心组件

### 核心ASR模型
- **Paraformer** - 中文语音识别的主要ASR模型
- **SenseVoice** - 替代ASR架构
- **FSMN-VAD** - 语音活动检测
- **CT-Transformer** - 标点恢复

### 音频处理
- **重采样** - 音频格式转换
- **特征提取** - MFCC和FBank特征
- **编码转换** - 音频编码工具

### 流式基础设施
- **Websocket服务器** - 实时音频流接口
- **双通处理** - 混合流式/离线方法
- **麦克风输入** - 直接音频捕获

### 语言支持
- **中文语言** - 主要语言支持，使用UTF-8文本处理
- **热词检测** - 可定制的关键词识别
- **词汇表管理** - 动态词汇表处理

## 构建系统

项目使用CMake进行跨平台构建：

```bash
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### 可选功能
- **Websocket服务器** - 启用实时流式处理
- **PortAudio** - 音频输入/输出支持
- **GPU加速** - CUDA支持以加速推理

## 使用方法

### Websocket服务器
```bash
./build/funasr-wss-server --model-dir models/damo/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-onnx
```

### 客户端应用程序
```bash
./build/funasr-wss-client --audio-file audio.wav
```

## 依赖项

- **ONNX Runtime** - 模型推理引擎
- **Kaldi** - 语音识别工具包
- **OpenFST** - 有限状态转换器库
- **Asio** - 异步I/O
- **FFmpeg** - 音频处理

## 模型文件

预训练模型可从阿里巴巴达摩院获取，应放置在`models/`目录中。系统支持：
- ASR模型（Paraformer、SenseVoice）
- VAD模型（FSMN-VAD）
- 标点模型（CT-Transformer）
- 语言模型（N-gram FST）

## 许可证

本项目使用各种开源库。请参考各个组件的许可证以获取详细信息。

## 贡献

欢迎贡献！请确保代码遵循现有风格并包含适当的测试。
