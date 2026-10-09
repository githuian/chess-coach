// Coaching text in English and Simplified Chinese. English is the default so tests and
// node scripts get the original wording; the panel calls setLang() from its settings.
const PIECES = {
  en: { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' },
  zh: { p: '兵', n: '马', b: '象', r: '车', q: '后', k: '王' },
};

const STRINGS = {
  en: {
    white: 'White',
    black: 'Black',
    hasWon: ({ side }) => `${side} has won`,
    mateIn: ({ side, n }) => `${side} has mate in ${n}`,
    equal: 'About equal',
    slightlyBetter: ({ side }) => `${side} is slightly better`,
    clearlyBetter: ({ side }) => `${side} is clearly better`,
    winning: ({ side }) => `${side} is winning`,
    undefended: 'attacked and undefended',
    attackedByCheaper: ({ by }) => `attacked by a ${by}, which is worth less`,
    and: ' and ',
    comma: ', ',
    missesForcedMate: 'misses the forced mate',
    pawnsWorse: ({ x }) => `is about ${x} pawns worse`,

    inCheck: 'You are in check, so this move has to deal with that first.',
    pieceInDanger: ({ piece, sq, danger }) => `Your ${piece} on ${sq} is ${danger}.`,
    theirThreat: ({ san }) => `Their threat: ${san}`,
    threatMate: ({ n }) => `, leading to checkmate in ${n}`,
    threatWins: ({ piece }) => `, winning your ${piece}`,
    threatEnd: ({ text }) => `${text}. Make sure your move handles it.`,

    checkmate: 'Checkmate! The game ends right here.',
    forcedMate: ({ n }) => `Starts a forced checkmate in ${n}. Every defence loses; follow the line below.`,
    rescues: ({ piece, sq, danger }) => `Rescues your ${piece}: on ${sq} it was ${danger}.`,
    freePiece: ({ piece, sq }) => `Wins a ${piece} for free: nothing of theirs can take back on ${sq}.`,
    winsMaterial: ({ piece, pv, captured, cv }) => `Wins material: your ${piece} (${pv}) takes a ${captured} (${cv}), so you come out ahead even if they recapture.`,
    tradeAhead: ({ piece, captured }) => `Trades ${piece} for ${captured}. When you're ahead in material, trading pieces brings you closer to a won endgame.`,
    tradeEven: ({ piece, captured }) => `Trades ${piece} for ${captured}, an even exchange that improves your position.`,
    givesUp: ({ piece, captured }) => `Gives up your ${piece} for a ${captured} on purpose: the engine sees the follow-up is worth it.`,
    promotes: ({ piece }) => `Promotes the pawn to a ${piece}.`,
    castles: 'Castles: tucks your king behind its pawns and brings the rook toward the center, where it can fight.',
    givesCheck: 'Gives check, so your opponent has to answer it and you keep the initiative.',
    handlesThreat: ({ piece, sq }) => `Takes care of the threat to your ${piece} on ${sq}.`,
    stopsIdea: ({ san }) => `Stops their idea of ${san}.`,
    defendsMate: ({ san }) => `Defends against their mating idea ${san}.`,
    theKing: 'the king',
    pieceOn: ({ piece, sq }) => `the ${piece} on ${sq}`,
    fork: ({ piece, sq, targets }) => `Fork! Your ${piece} on ${sq} attacks ${targets} at the same time, and they can't deal with both.`,
    attacks: ({ piece, sq, undefended }) => `Attacks their ${piece} on ${sq}${undefended ? ', which has no defender' : ''}, so they have to react.`,
    bait: ({ piece, reply, follow }) => `Leaves your ${piece} where it can be taken, but taking it is a trap: after ${reply} you have ${follow}.`,
    develops: ({ piece }) => `Develops your ${piece}. Getting pieces off the back rank and toward the center is the main job in the opening.`,
    center: 'Grabs space in the center, which gives your pieces more room and limits theirs.',
    openFile: ({ file }) => `Puts the rook on the open ${file}-file, where it has a clear road into their position.`,
    prepares: ({ next, reply, piece }) => `Prepares ${next} next (after ${reply}), winning their ${piece}.`,
    gains: ({ n }) => `By the end of the main line you've gained about ${n} points of material.`,
    sacrifice: ({ n }) => `It's a sacrifice: you give up about ${n} points of material, but your active pieces and attack are worth more.`,
    onlyMove: ({ san, gap }) => `This is the only good move here. The next best, ${san}, ${gap}.`,
    quiet: 'A quiet improving move. There is no tactic here; the engine just finds this the most useful way to improve your position.',
    alsoGood: ({ san }) => `${san} is about as good, so you have options in this position.`,

    // Panel
    waiting: 'Waiting for a board…',
    bestLabel: ({ side }) => `${side} to move · best move`,
    watchOut: 'Watch out',
    why: 'Why',
    mainLine: 'Main line',
    otherOptions: 'Other options',
    sideToMove: 'Side to move',
    auto: 'Auto',
    depth: 'Depth',
    fast: 'Fast',
    normal: 'Normal',
    deep: 'Deep',
    showArrows: 'Show arrows on board',
    language: 'Language',
    popupTitle: 'Chess Coach',
    autoBrowser: 'Auto (browser language)',
    popupNote: 'Applies right away to the coach panel on chess.com.',
    thinking: ({ d }) => `Thinking… depth ${d}`,
    depthN: ({ d }) => `Depth ${d}`,
    justAsGood: ({ e }) => `${e} · just as good`,
    worseBy: ({ e, x }) => `${e} · ${x} worse`,
    missesMate: ({ e }) => `${e} · misses mate`,
    assumeWhite: 'Couldn\'t see the last move, so assuming White to move. Use "Side to move" below if that\'s wrong.',
    illegal: 'Can\'t read a legal position from the board yet. If a piece is mid-move, finish the move.',
    gameOverMate: 'Checkmate. Game over.',
    gameOverDraw: 'The game is drawn.',
    liveOff: 'Coach is off during games against people (learning mode). After the game, open Game Review or Analysis and the coach turns back on.',
  },
  zh: {
    white: '白方',
    black: '黑方',
    hasWon: ({ side }) => `${side}已获胜`,
    mateIn: ({ side, n }) => `${side}可在${n}步内将杀`,
    equal: '局面大致均势',
    slightlyBetter: ({ side }) => `${side}略占优势`,
    clearlyBetter: ({ side }) => `${side}明显占优`,
    winning: ({ side }) => `${side}已占胜势`,
    undefended: '受到攻击且没有保护',
    attackedByCheaper: ({ by }) => `受到价值更低的${by}攻击`,
    and: '和',
    comma: '、',
    missesForcedMate: '会错过强制将杀',
    pawnsWorse: ({ x }) => `大约差${x}个兵`,

    inCheck: '你正被将军，这步棋必须先应将。',
    pieceInDanger: ({ piece, sq, danger }) => `你在${sq}的${piece}${danger}。`,
    theirThreat: ({ san }) => `对方的威胁：${san}`,
    threatMate: ({ n }) => `，${n}步内将杀`,
    threatWins: ({ piece }) => `，吃掉你的${piece}`,
    threatEnd: ({ text }) => `${text}。确保你的着法能应对它。`,

    checkmate: '将杀！对局到此结束。',
    forcedMate: ({ n }) => `开始${n}步强制将杀。对方怎么防守都会输，按下面的主要变化走即可。`,
    rescues: ({ piece, sq, danger }) => `救出你的${piece}：它在${sq}${danger}。`,
    freePiece: ({ piece, sq }) => `白吃一个${piece}：对方没有棋子能在${sq}吃回。`,
    winsMaterial: ({ piece, pv, captured, cv }) => `得子：你的${piece}（${pv}分）吃掉${captured}（${cv}分），即使对方吃回你也占便宜。`,
    tradeAhead: ({ piece, captured }) => `用${piece}换${captured}。子力领先时，兑子能让你更接近赢棋的残局。`,
    tradeEven: ({ piece, captured }) => `用${piece}换${captured}，等价交换，同时改善你的局面。`,
    givesUp: ({ piece, captured }) => `故意用你的${piece}换对方的${captured}：引擎算出后续手段值得这样做。`,
    promotes: ({ piece }) => `兵升变为${piece}。`,
    castles: '王车易位：把王藏到兵的后面，同时让车靠近中心参与战斗。',
    givesCheck: '将军，对方必须应将，你保持主动。',
    handlesThreat: ({ piece, sq }) => `化解了对你在${sq}的${piece}的威胁。`,
    stopsIdea: ({ san }) => `阻止了对方走${san}的意图。`,
    defendsMate: ({ san }) => `防住了对方${san}的将杀企图。`,
    theKing: '王',
    pieceOn: ({ piece, sq }) => `${sq}的${piece}`,
    fork: ({ piece, sq, targets }) => `捉双！你在${sq}的${piece}同时攻击${targets}，对方无法兼顾。`,
    attacks: ({ piece, sq, undefended }) => `攻击对方在${sq}的${piece}${undefended ? '（它没有保护）' : ''}，迫使对方应对。`,
    bait: ({ piece, reply, follow }) => `把你的${piece}放在能被吃的位置，但吃它是陷阱：对方走${reply}后，你有${follow}。`,
    develops: ({ piece }) => `出动你的${piece}。开局的首要任务就是把棋子从底线调往中心。`,
    center: '抢占中心空间，让你的棋子更有活动余地，同时限制对方。',
    openFile: ({ file }) => `把车放到开放的${file}线上，可以直接攻入对方阵地。`,
    prepares: ({ next, reply, piece }) => `为下一步${next}做准备（在对方走${reply}之后），吃掉对方的${piece}。`,
    gains: ({ n }) => `走完主要变化后，你大约多得${n}分子力。`,
    sacrifice: ({ n }) => `这是弃子：你放弃约${n}分子力，但棋子的活跃度和攻势更有价值。`,
    onlyMove: ({ san, gap }) => `这是这里唯一的好棋。次优的${san}${gap}。`,
    quiet: '一步安静的改进着法。这里没有战术，引擎只是认为这是改善局面最有用的走法。',
    alsoGood: ({ san }) => `${san}差不多一样好，这个局面你有多种选择。`,

    waiting: '等待棋盘…',
    bestLabel: ({ side }) => `${side}走 · 最佳着法`,
    watchOut: '注意',
    why: '为什么',
    mainLine: '主要变化',
    otherOptions: '其他选择',
    sideToMove: '轮到谁走',
    auto: '自动',
    depth: '深度',
    fast: '快速',
    normal: '标准',
    deep: '深入',
    showArrows: '在棋盘上显示箭头',
    language: '语言',
    popupTitle: '国际象棋教练',
    autoBrowser: '自动（跟随浏览器语言）',
    popupNote: '立即应用到 chess.com 上的教练面板。',
    thinking: ({ d }) => `思考中… 深度 ${d}`,
    depthN: ({ d }) => `深度 ${d}`,
    justAsGood: ({ e }) => `${e} · 一样好`,
    worseBy: ({ e, x }) => `${e} · 差 ${x}`,
    missesMate: ({ e }) => `${e} · 错过将杀`,
    assumeWhite: '看不到上一步棋，所以假定轮到白方走。如果不对，请在下方“轮到谁走”中选择。',
    illegal: '暂时无法从棋盘读取合法局面。如果有棋子正在移动，请先完成这步棋。',
    gameOverMate: '将杀，对局结束。',
    gameOverDraw: '和棋。',
    liveOff: '与真人对局时教练会关闭（学习模式）。对局结束后，打开 Game Review（对局复盘）或 Analysis（分析），教练会重新开启。',
  },
};

let lang = 'en';

export function setLang(l) {
  lang = STRINGS[l] ? l : 'en';
}

export function getLang() {
  return lang;
}

// 'auto' follows the browser language; any Chinese locale gets Simplified Chinese.
export function resolveLang(setting, browserLang = '') {
  if (setting === 'en' || setting === 'zh') return setting;
  return browserLang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function t(key, vars = {}) {
  const s = STRINGS[lang][key] ?? STRINGS.en[key];
  return typeof s === 'function' ? s(vars) : s;
}

export function pieceName(type) {
  return PIECES[lang][type];
}

export function colorName(c) {
  return t(c === 'w' ? 'white' : 'black');
}

export function listText(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(t('comma'))}${t('and')}${items[items.length - 1]}`;
}
