# 规则内核以 C# 单源实现，网页端经 WebAssembly 运行

规则内核是一个纯 C# 类库，语法锁定在 C# 9 / .NET Standard 2.1，以对齐 Unity 6.6 的 Mono 运行时。Unity 直接引用源码；无头批量模拟用 .NET 控制台运行；网页端把同一份源码编译为 .NET WebAssembly，由 TypeScript 表现层调用。最终产品在 Unity，内核的调试、性能与严密性应站在 C# 这边；网页端需要快速迭代的是表现层与内容数据，它们不受内核语言影响。

## Considered Options

- TypeScript 单源，Unity 端经 PuerTS 等嵌入式 JS 引擎运行：游戏本体的核心逻辑会活在 Unity 里的 JS 虚拟机中，与"Unity 端严密夯实本体"的定位相反。
- 两端各写一套实现，靠一致性测试约束：每条规则、每个效果写两遍，成本随卡牌数量线性增长，且迟早漂移。

## Consequences

- 在 Unity 迁移到 CoreCLR（预计 Unity 6.8 / 7.0）之前，内核不能使用 C# 10 及以后的语法。
- 网页端首次加载多出数 MB 的 .NET 运行时；修改内核后需要重新编译 WebAssembly。
