# OpenSLR Santiago 西语参考源运行与完成报告

## 结论

OpenSLR Resource 34（Santiago Spanish Lexicon）现已接入为西班牙语第二个独立参考来源，但只能输出观察结果和方言变体风险，不能自动把任何 es-ES 条目标记为双来源确认。

当前 strict queue 快照的无网络计划结果：

| 指标 | 数量 |
| --- | ---: |
| strict queue 资产 | 352 |
| es-ES 目标资产 | 51 |
| es-ES 唯一词 | 36 |
| 可自动用于 es-ES 确认的资产 | 0 |
| 可自动用于 es-ES 确认的词 | 0 |
| 本次执行网络请求 | 0 |
| 正式音频变更 | 0 |

计划 SHA-256 为 8168884867fb7fb216668fad575e4f815d573c8b418a0366a92c314e683ca1b9。计划和计划覆盖报告位于被 Git 忽略的 outputs/phoneme-word-auditory-audit-2026-07-14/reference-sources/openslr-santiago-spanish/。

## 来源身份与地区边界

- publisherId：openslr
- independenceGroup：santiago-spanish-lexicon-resource-34
- resource/version：OpenSLR 34 / SLR34
- license：Apache-2.0
- 文档所指地区：Santiago, Chile
- 规范化来源语言标签：es-CL
- 项目目标语言：es-ES
- 地区匹配状态：cross-locale-variant-risk

Santiago/智利西语与西班牙本土 es-ES 在 seseo、辅音实现、弱化和其他音系细节上可能不同。即使词形命中且音素可以完整映射为 IPA，工具仍将该词保留在 unresolved.json，并要求 es-ES 人工或可靠本土来源复核。独立发布身份只说明来源链独立，不代表地区适用性相同。

## 命令生命周期

生成确定性计划和零网络覆盖报告：

~~~powershell
node scripts/openslr-spanish-reference-enrichment.mjs plan
~~~

使用用户已经取得的本地 santiago.tar.gz 或已解压词典，不产生网络请求：

~~~powershell
node scripts/openslr-spanish-reference-enrichment.mjs import --input <本地文件> --expected-sha256 <64位小写SHA-256>
node scripts/openslr-spanish-reference-enrichment.mjs parse
~~~

expected-sha256 可省略，但 checkpoint 会明确记录 operator-supplied-unverified。import 和 parse 均不会发起网络请求。

未来确需从官方源获取时，必须显式确认：

~~~powershell
node scripts/openslr-spanish-reference-enrichment.mjs fetch --confirm
~~~

fetch 只允许以下精确 HTTPS 地址及它们之间的安全重定向：

- https://www.openslr.org/resources/34/santiago.tar.gz
- https://openslr.org/resources/34/santiago.tar.gz
- https://openslr.elda.org/resources/34/santiago.tar.gz

协议降级、查询参数、认证信息、其他主机、其他资源编号和任意重定向都会被拒绝。本次实现与验证未运行 fetch。

## Checkpoint 与输出

checkpoint.json 固定保存：

- planSha256、publisherId、independenceGroup；
- resourceId、datasetVersion、Apache-2.0 许可元数据；
- 来源/目标地区边界以及禁止自动确认标记；
- 获取方式、来源 URL、本地缓存相对路径、字节数、SHA-256；
- 本地导入的 provenanceStatus 或官方下载的 HTTP 状态与请求数；
- parse 的成员名、行数、异常行数、覆盖率和输出文件清单。

parse 生成：

- parsed.json：逐词完整解析与来源行；
- observations.json：仅观察结果和方言风险；
- unresolved.json：未命中、映射不完整以及所有跨地区命中项；
- report.json：资产/词观察覆盖、IPA 映射覆盖、变体风险覆盖和固定为 0 的 es-ES 确认覆盖。

每条来源映射同时保留 rawPhonemes、normalizedPhonemes、rawIpa、normalizedIpa、mappingScheme、unmappedSymbols 和 mappingWarnings。音素表中含糊的 rhotic、seseo 符号和数字重音不会被静默当作无风险的 es-ES IPA。

全部运行产物位于根级 outputs/ 下，已由项目 .gitignore 忽略。工具不读写 public/audio 或 apps/browser/public/audio，也没有任何正式音频提升、替换或覆盖路径。

## 验证

契约测试覆盖官方 URL allowlist、显式网络确认、路径边界、确定性 51/36 计划所用的分组逻辑、来源身份、许可、方言门禁、音素/IPA 原始与规范化字段、tar.gz 安全解析、路径穿越拒绝、checkpoint 以及确认覆盖固定为 0：

~~~powershell
node scripts/openslr-spanish-reference-enrichment.contract.mjs
npx biome check scripts/lib/openslr-spanish-reference-enrichment-core.mjs scripts/openslr-spanish-reference-enrichment.mjs scripts/openslr-spanish-reference-enrichment.contract.mjs
~~~
