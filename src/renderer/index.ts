import '../renderer';

const mod = module as NodeModule & { hot?: { accept(): void } };
if (mod.hot) mod.hot.accept();
