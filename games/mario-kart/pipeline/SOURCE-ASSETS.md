# Conversões locais opcionais de recursos

Estas ferramentas convertem modelos de Mario Kart 8 fornecidos localmente. As artes de origem pertencem à Nintendo, não são criações originais do GameVitto e não estão cobertas pela licença MIT do código deste repositório. Arquivos compactados, texturas, modelos GLB convertidos e dados de trajeto derivados das fontes permanecem em diretórios locais ignorados, como `assets/` e `evidence/`. A versão pública mantém alternativas procedurais para esses recursos.

As ferramentas utilizam o servidor HTTP local e as instalações existentes do Three.js, Playwright e Chrome. Elas não baixam recursos, não publicam conteúdo e não modificam o manifesto de jogabilidade. Inicie o servidor normal de desenvolvimento antes de executá-las. A origem padrão para conversão é `http://localhost:8080`. Use `KART_BUILD_ORIGIN` para informar outro endereço.

## Mario e Kart Padrão

```sh
node games/mario-kart/pipeline/build-source.mjs
```

As entradas são os arquivos extraídos de Mario, Kart Padrão e Pneu Padrão dentro de `games/mario-kart/evidence/asset-study/`, ou um endereço correspondente fornecido por `KART_SOURCE_URL`. As páginas de origem e os créditos de quem enviou os arquivos são registrados no JSON de procedência produzido pela conversão.

O conversor corrige as camadas das pupilas, posiciona o esqueleto, aplica texturas de pintura e emblema ao kart e cria quatro pivôs independentes para as rodas usando a máscara emissiva do pneu original. Durante a execução, a geometria original dos aros é preservada e recebe o comportamento próprio e suavizado de inclinação e material da antigravidade.

Os resultados são `assets/mario-kart/mario-source.glb` e um arquivo auxiliar de procedência e hashes. Os modelos procedurais originais continuam disponíveis como arquivos locais separados. O manifesto local atual seleciona conversões de origem para os oito pilotos.

## Outros sete pilotos

```sh
node games/mario-kart/pipeline/build-source-rivals.mjs
```

Argumentos opcionais permitem escolher pilotos específicos: `luigi peach yoshi toad bowser donkey-kong koopa`. As entradas são pastas locais extraídas de cada piloto, além das mesmas pastas de kart e pneus usadas por Mario.

O conversor preserva o chassi já validado e os pivôs independentes dos pneus, seleciona a pintura e o emblema de cada piloto e ajusta um esqueleto com eixo Y para cima em uma pose sentada. Algumas texturas precisam se repetir porque as coordenadas UV do corpo de Luigi e dos olhos de Koopa ultrapassam o quadrado unitário. As camadas de pupilas são ocultadas porque elas já estão incluídas nos atlas dos olhos. A língua estendida da pose de repouso de Yoshi é recolhida. O cabelo, a saia e as pernas ocultas de Peach são ajustados ao assento. Essas poses e proporções foram definidas artisticamente e não são animações da Nintendo.

Os resultados usam o nome `<id>-source.glb` e recebem arquivos auxiliares de procedência contendo páginas de origem, registros dos arquivos, hashes das entradas e dos conversores, créditos dos recursos compartilhados e hashes das saídas. A conversão não altera o manifesto. A seleção do manifesto local foi feita após uma revisão dos modelos exportados em três ângulos.

O comando abaixo captura os oito modelos exportados pela frente, por trás e pela lateral, além de verificar os metadados da cabeça e das rodas usados durante a execução:

```sh
node games/mario-kart/pipeline/review-source-rivals.mjs
```

A variável `EVIDENCE_DIR` permite alterar a pasta de saída. Essa revisão de estúdio é separada da corrida completa e da verificação dos bytes carregados.

## Estádio Mario Kart

```sh
node games/mario-kart/pipeline/build-source-stadium.mjs
```

Por padrão, o comando utiliza OBJ, MTL e texturas extraídos em `games/mario-kart/evidence/asset-study/stadium/`. Use `KART_STADIUM_DIR` para informar outro diretório e `KART_STADIUM_URL` para fornecer o endereço correspondente no servidor. A pasta precisa conter os arquivos `Mario Kart Stadium.obj`, `Mario Kart Stadium.mtl` e as texturas originais.

O construtor executa `source-road.py` com a biblioteca padrão do Python para recuperar o centro real da pista a partir das interseções UV da malha. Ele valida a topologia sem ramificações e a ordem das junções de referência, preserva o vão de lançamento e coleta posições e normais. Em seguida, `source-surface.py` associa os triângulos indexados do solo, suas normais, a classificação da pista e as máscaras dos painéis de impulso.

As consultas feitas durante a execução usam esses triângulos por meio de uma grade espacial. As consultas de largura mantêm separados os diferentes ramos da pista e unem apenas faixas divisórias estreitas. `KART_STADIUM_ROUTE` pode fornecer um trajeto calculado previamente.

A conversão de materiais resolve diferenças entre letras maiúsculas e minúsculas nos nomes dos arquivos, adiciona mapas normais e emissivos, preserva transparências recortadas e oculta a malha opaca usada somente como sombra e dois grupos de luz posicionados incorretamente por meio de `source-visible.js`. A geometria das luzes do teto permanece visível. Essas mesmas exclusões são aplicadas a pacotes convertidos anteriormente. A união dos vértices no GLB preserva as divisões de UV e normais.

São produzidos `assets/mario-kart/stadium-source.glb`, `stadium-route.json` e `stadium-source.provenance.json`. A procedência inclui hashes de todos os arquivos de entrada e conversores, além da página de origem e dos créditos. O manifesto local ignorado seleciona essa pista por meio de `course: {model: "stadium-source.glb", route: "stadium-route.json"}`. A condução, os contatos e a câmera de perseguição usam a superfície tridimensional medida. O parâmetro `?sourceCourse=0` seleciona a pista original. Quando o pacote opcional está ausente ou inválido, a alternativa procedural é usada automaticamente.

O comando abaixo recarrega o GLB exportado, mede interseções independentes de raios em todas as amostras do trajeto que não estão no ar e captura 14 posições em `games/mario-kart/evidence/asset-study/stadium-converted/`:

```sh
node games/mario-kart/pipeline/review-source-stadium.mjs
```

Essa é uma verificação geométrica, não um teste de corrida ou controle. A verificação da geometria por si só não representa aprovação da jogabilidade.

O asfalto original usa seus mapas normais com intensidade 1,1 e uma aproximação artística da rugosidade calculada pelo valor SPM original: `0.56 - 0.26 * sqrt(scalar / 255)`. Essas texturas repetem o valor escalar em RGBA. O conversor lê o canal alfa para evitar perdas causadas pela pré multiplicação do Canvas. Os canais verdes de rugosidade exportados foram comparados pixel por pixel com os PNGs originais. Isso não reproduz o shader da Nintendo. O arquivo `source-materials.js` também aplica níveis de emissão às lâmpadas e janelas mascaradas originais.

O solo físico inclui os barrancos gramados `fc_shiba` como superfícies fora da pista. Uma falha na última curva revelou grama visível aproximadamente 1,8 metro acima do antigo plano alternativo. A malha corrigida do solo contém 12.162 triângulos e 12.056 vértices. Raios independentes aplicados à malha exportada verificam as duas posições em que houve falha, além das amostras comuns do trajeto. Regenerar somente a geometria do trajeto não altera o GLB. O arquivo auxiliar de procedência registra separadamente a revisão e o hash do trajeto.

## Telas e identidade visual do estádio

Durante a execução, `source-screens.js` corrige as coordenadas V somente nas superfícies importadas `fc_TV_MKTV` e `fc_TV_capture`. Os vértices superiores físicos têm V igual a zero na fonte, o que invertia tanto a imagem original quanto a transmissão da corrida pela GPU. As outras placas e o GLB armazenado não são alterados.

O comando abaixo renderiza um cartão de calibração identificado por meio dos caminhos de bitmap e alvo de renderização. Ele mede os cantos derivados da altura física no espaço do mundo e verifica se a correção pode ser aplicada novamente sem produzir alterações adicionais:

```sh
node games/mario-kart/source-screen-review.mjs
```

O comando a seguir reúne 49 quadros locais chamados `mktv.<n>.png` em um atlas com bordas preenchidas e grava hashes de entrada e saída e metadados de disposição:

```sh
python3 games/mario-kart/pipeline/build-source-tv.py
```

O atlas não é selecionado automaticamente. O manifesto local ignorado fornece sua descrição por meio de `course.tvBrand`. Durante a execução, as dimensões são validadas, uma única textura é usada, a introdução original é reproduzida e a animação do sinal do logotipo completo entra em repetição. O tempo foi definido artisticamente em 20 quadros por segundo. Quando a identidade opcional está ausente ou inválida, a imagem original é mantida. Os cenários gerados não são afetados. A ferramenta de captura inclui os PNGs para que os bytes do atlas carregados pelo navegador sejam verificados junto com o código e os GLBs.

O parâmetro `?sourceCourse=1` dá preferência ao descritor completo do manifesto local, incluindo a identidade visual opcional, e utiliza os nomes de arquivo convencionais somente quando não existe um descritor. O parâmetro `?sourceCourse=0` mantém a pista gerada. O comando `node games/mario-kart/source-pack-review.mjs` exercita os dois caminhos de seleção e também um atlas propositalmente indisponível. Novos relatórios de corrida preservam o manifesto de recursos obtido. A verificação exige que qualquer atlas de TV selecionado tenha sido carregado corretamente e corresponda ao hash preservado.
