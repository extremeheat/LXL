## 0.6.0
### Breaking

* CompletionService and GoogleAIStudioCompletionService
  * `.requestCompletion` now returns an array of completions

### Features
* `.requestCompletion`'s options objects now also take in the following options, which will be passed to the model's generation options:
```coffee
    maxTokens: number
    temperature: number
    topP: number
    topK: number
```
* The constructors for CompletionService and GoogleAIStudioCompletionService have also been updated to take an additional objects object. These the object can contain a `generationOptions` dictionary that will be applied by default to all requestCompletion calls. You can override these options by passing them in individual requestCompletion calls.
* Export a `SafetyError` object that can be used in instanceof checks to see if a model response failed due content filtering rules.

#### Flow
Added Flow, a class for building dialogues, see [docs/flow.md](https://github.com/extremeheat/LXL/blob/main/docs/flow.md).

### Changelog
* [Breaking changes to allow custom generation options and multi-completions (#28)](https://github.com/extremeheat/LXL/commit/2d836f2ad6e8cd177fc46b18f945725d9083ae50) (thanks @extremeheat)
* [Support Gemini 1.5 Pro with Google AI Studio API (#27)](https://github.com/extremeheat/LXL/commit/73cdf1d0f079e8f2440765bef9d7484f0c76b5ba) (thanks @extremeheat)
* [Add Flow for advanced prompt flows with templating (#23)](https://github.com/extremeheat/LXL/commit/03cf5261395fe619a325e008ad29ab406529eda8) (thanks @extremeheat)
* [Add `stripDiff`, support truncation and binary files in collectFolderFiles and markdown gen, handle corrupt caches (#20)](https://github.com/extremeheat/LXL/commit/fe7a4a5871787fdbfd829d548852e588f5ec8ab9) (thanks @extremeheat)

## 0.5.1
* [GoogleAIStudio: add option to send requests to HTTP server relay (#18)](https://github.com/extremeheat/LXL/commit/afb1d1e2344072967bbe092660793a213be751b0) (thanks @extremeheat)

## 0.5.0
* [Add support for response caching, updates and fixes to tools (#16)](https://github.com/extremeheat/LXL/commit/2f0653ddaef850a659f585e95ad0f279dcf51a24) (thanks @extremeheat)
* [Add experimental autoFeed option to GoogleAIStudioCompleter, update tooling (#15)](https://github.com/extremeheat/LXL/commit/cb747114dbec6167fe5ac9021ea88ec2a049c001) (thanks @extremeheat)
* [Add guidance regions for prompts (#14)](https://github.com/extremeheat/LXL/commit/d17fe7521ed68eedf028e0089d8a446b5d349c07) (thanks @extremeheat)
* [tools: add collectFolderFiles, concatFilesToMarkdown (#13)](https://github.com/extremeheat/LXL/commit/c61429d4c11abc0f863ecabc73962cc27c9235f3) (thanks @extremeheat)
* [Add markdown stripping tool and a custom YAML writer (#12)](https://github.com/extremeheat/LXL/commit/a7fd21dd0d94c30145185047f520160ec9263574) (thanks @extremeheat)
* [Add throttling to Google AI studio handling](https://github.com/extremeheat/LXL/commit/008ffad6b9f0dc0f17c77481d275b05d43d1b817) (thanks @extremeheat)

## 0.4.0
* [Add a markdown pre-processor for templating prompts at runtime (#10)](https://github.com/extremeheat/LXL/commit/382d5c3dad016ff9b71aca83ea6131c861a20327) (thanks @extremeheat)
* [Support Gemini 1.5 via Google AI studio playground (#9)](https://github.com/extremeheat/LXL/commit/3cad49f578957a814188b1ddd56dd9621ff2777e) (thanks @extremeheat)
* [Update model handling for generality instead of being explicit](https://github.com/extremeheat/LXL/commit/b34f38904fa791f94be38f4b4664c1de51a39582) (thanks @extremeheat)
* [Add a collectGithubRepoFiles tool (#8)](https://github.com/extremeheat/LXL/commit/aa509273e6e9843459f6eac93dfe90c066d3cf3e) (thanks @extremeheat)

## 0.3.0
* [Add function calling support (#6)](https://github.com/extremeheat/LXL/commit/e88a604aaeb4cc2f4eb45e0044d9f942187c025b) (thanks @extremeheat)

## 0.2.1
* [Add HTML viz for side-by-side comparing LLM output (#4)](https://github.com/extremeheat/LXL/commit/8a98e861c999500e2abb4176880067d2036d66d3) (thanks @extremeheat)
* [Fix getting keys from fs (#3)](https://github.com/extremeheat/LXL/commit/0c37eb431003e9bad33965ff66f24f8406d82954) (thanks @extremeheat)

## 0.2.0
* Update API

## 0.1.0
* initial release
