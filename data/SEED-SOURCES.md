# Fontes do dataset base

- **Vocabulário:** [Google 10,000 English Words](https://github.com/first20hours/google-10000-english), usando a variante sem palavrões e mantendo a ordem de frequência. Os 3.000 vocábulos originais do aplicativo foram preservados no início; as novas palavras foram adicionadas somente quando não havia duplicata.
- **Phrasal verbs:** [PHaVE dictionary](https://phave-dictionary.englishup.me/faq/index.html) e o estudo [A frequency-based list of phrasal verbs](https://journals.sagepub.com/doi/10.1177/1362168814559798). Os 150 itens existentes foram preservados; os itens adicionais são expressões cotidianas selecionadas para completar a cobertura prática do aplicativo.
- **Frases de sobrevivência:** [Survival English](https://www.insl.com.br/english/files/vocabulary/travel/Survival%20English.pdf). As frases adicionais foram redigidas ou adaptadas para situações diárias de comunicação, transporte, hospedagem, alimentação, compras e emergências.

O script `scripts/expand-seed-data.js` é reexecutável: ele preserva os registros existentes, evita duplicatas e só acrescenta itens ausentes.
