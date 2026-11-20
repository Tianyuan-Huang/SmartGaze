# SmartGaze

Code accompanying **SmartGaze: Personalized Proactive Visual Assistance for Blind and Low-Vision Users via a Scene-Conditioned Skill Graph**.

Tianyuan Huang, Zhi Yu, Xiaozhong Liu · **AAAI-27 Demonstration Program**

SmartGaze personalizes proactive visual assistance through PRISM, a scene-conditioned skill graph. Pairwise feedback learns information preferences, scoped corrections adapt them to particular scenes, and temporary goals guide assistance for the task at hand. The application supports English and Chinese.

## Code

- [prism/](prism/) — scene–skill graph, Bayesian preference learning and calibration questions.
- [personalized-push.mjs](personalized-push.mjs) — preference-conditioned visual requests and response handling.
- [src/](src/) — web interface, camera input and speech interaction.
- [server.mjs](server.mjs) and [model-adapter.mjs](model-adapter.mjs) — application API and visual-model integration.

## Getting started

Requires Node.js 22.12+, pnpm 11.25.0 and OpenSSL 1.1.1+. Visual inference uses [JoyAI-VL-Interaction-Preview](https://huggingface.co/jdopensource/JoyAI-VL-Interaction-Preview), served locally through vLLM with its chat-completions and metrics endpoints.

```bash
git clone https://github.com/Tianyuan-Huang/SmartGaze.git
cd SmartGaze
pnpm install --frozen-lockfile
pnpm setup
```

Set the local model endpoint and served model name in the generated `.env` using `MODEL_API_BASE` and `MODEL_NAME`. For voice transcription, set `DEMO_SPEECH_KEY` to a Beijing-region DashScope key for Qwen3-ASR-Flash.

```bash
pnpm build
pnpm start
```

Open `https://localhost:18475/en` or `/zh`. Setup creates demo accounts `user01`–`user05`, with initial passwords matching their usernames. Mobile camera and microphone access require trusted HTTPS.

Run `pnpm test` for integration tests using a mocked model.

## Citation

```bibtex
@inproceedings{huang2027smartgaze,
  title     = {{SmartGaze}: Personalized Proactive Visual Assistance for Blind and Low-Vision Users via a Scene-Conditioned Skill Graph},
  author    = {Huang, Tianyuan and Yu, Zhi and Liu, Xiaozhong},
  booktitle = {Proceedings of the AAAI Conference on Artificial Intelligence},
  year      = {2027},
  note      = {Demonstration Program, accepted}
}
```

## License

[MIT](LICENSE). External models and dependencies retain their respective licenses.
