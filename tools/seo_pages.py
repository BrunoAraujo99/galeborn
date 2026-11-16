"""Builds the crawlable info pages (one per language) into seo/.
The game page itself is left alone; these pages describe the game for search
engines and link back to it. Run: python3 tools/seo_pages.py  (build.py copies seo/ into the web build)."""
import os, shutil, json, html

SITE = 'https://playgaleborn.fun'
# path, hreflang, html lang
LANGS = [('en', 'about', 'en', 'en'), ('pt', 'pt', 'pt', 'pt'), ('fr', 'fr', 'fr', 'fr'), ('de', 'de', 'de', 'de'), ('zh', 'zh', 'zh-Hans', 'zh-Hans')]
NAMES = {'en': 'English', 'pt': 'Português', 'fr': 'Français', 'de': 'Deutsch', 'zh': '简体中文'}

T = {
'en': dict(
  title='Galeborn: Free Anime Fighting Game in Your Browser',
  desc='Galeborn is a free 3D anime elemental fighting game you play in your browser. Duel friends or ranked players online, fight bots, or take on a boss. No download.',
  h1='Galeborn, a free anime elemental duel game',
  lead='Galeborn is a free 3D anime fighting game that runs straight in your browser, with no download or install. Pick a fighter who bends wind, fire, earth or water and settle it in fast, cinematic one-on-one duels.',
  play='Play free now', playsub='Runs in Chrome, Edge, Firefox and Safari',
  modesH='Game modes', modes=[('Online ranked','Matchmaking against players around the world, with ranked tiers, seasons and a leaderboard.'),('Vs a friend','Share a room code or invite link and duel a friend online.'),('Vs a bot','Practise against AI opponents at three difficulty levels.'),('Training','Six lessons that teach movement, combos, blocking, parrying and bursts.'),('Solo boss','Face Varukh, the Cinder Warden, a two-phase fire boss.')],
  heroesH='Fighters', heroes=['Fast air combos, dashes and the Tempest ultimate.','Aggressive fire martial arts and blazing strings.','Heavy earth strikes, guard breaks and stone spikes.','Flowing water combos and crowd control.'],
  titles=['The Wind Dancer','The Sunfire Fist','The Stonewall','The Tidecaller'],
  combatH='Anime combat', combat='Launchers, air combos, parries, guard breaks, beam struggles, ring-outs and slow-motion finishers, with anime impact frames and a cinematic camera. Each element has its own moveset and matchups.',
  arenasH='Arenas', arenas='Lantern Strait at sunset, Thunderhead Spire with lightning strikes, and Frostbell Pass with blizzard gusts, each with breakable pillars.',
  howH='How to play', how='Play with keyboard and mouse or a gamepad on any computer with a modern browser and WebGL. Galeborn is free to play: open the game and press Online, Vs a friend, Vs a bot, Training or Solo boss.',
  faqH='Questions', faq=[('Is Galeborn free?','Yes. Galeborn is completely free to play in your browser.'),('Do I need to download anything?','No. The game runs in your browser. An optional offline file is also available from the title screen.'),('Can I play with friends?','Yes. Choose Vs a friend and share the room code or invite link.')],
  langH='Languages'),
'pt': dict(
  title='Galeborn: Jogo de Luta Anime Grátis no Navegador',
  desc='Galeborn é um jogo de luta anime 3D grátis que se joga no navegador. Duelos online com amigos ou no ranked, contra bots ou contra um chefe. Sem download.',
  h1='Galeborn, um jogo de duelos elementais anime grátis',
  lead='Galeborn é um jogo de luta anime 3D grátis que corre diretamente no navegador, sem download nem instalação. Escolhe um lutador que domina o vento, o fogo, a terra ou a água e resolve tudo em duelos um contra um rápidos e cinematográficos.',
  play='Jogar grátis agora', playsub='Funciona no Chrome, Edge, Firefox e Safari',
  modesH='Modos de jogo', modes=[('Online ranked','Matchmaking contra jogadores de todo o mundo, com divisões, temporadas e tabela de classificação.'),('Contra um amigo','Partilha um código de sala ou link de convite e enfrenta um amigo online.'),('Contra um bot','Treina contra adversários controlados por IA em três níveis de dificuldade.'),('Treino','Seis lições sobre movimento, combos, bloqueio, parry e burst.'),('Chefe solo','Enfrenta Varukh, o Guardião das Cinzas, um chefe de fogo com duas fases.')],
  heroesH='Lutadores', heroes=['Combos aéreos rápidos, dashes e o ultimate Tempest.','Artes marciais de fogo agressivas e sequências ardentes.','Golpes de terra pesados, quebra de guarda e espigões de pedra.','Combos de água fluidos e controlo do adversário.'],
  titles=['O Dançarino do Vento','O Punho do Sol','A Muralha de Pedra','A Invocadora das Marés'],
  combatH='Combate anime', combat='Launchers, combos aéreos, parries, quebras de guarda, duelos de raios, ring-outs e finalizações em câmara lenta, com impact frames de anime e câmara cinematográfica. Cada elemento tem os seus próprios golpes e vantagens.',
  arenasH='Arenas', arenas='Lantern Strait ao pôr do sol, Thunderhead Spire com relâmpagos e Frostbell Pass com rajadas de neve, todas com pilares destrutíveis.',
  howH='Como jogar', how='Joga com teclado e rato ou com comando em qualquer computador com um navegador moderno e WebGL. Galeborn é grátis: abre o jogo e escolhe Online, Contra um amigo, Contra um bot, Treino ou Chefe solo.',
  faqH='Perguntas', faq=[('O Galeborn é grátis?','Sim. O Galeborn é totalmente grátis e joga-se no navegador.'),('Preciso de descarregar alguma coisa?','Não. O jogo corre no navegador. No ecrã inicial há também um ficheiro opcional para jogar offline.'),('Posso jogar com amigos?','Sim. Escolhe Contra um amigo e partilha o código da sala ou o link de convite.')],
  langH='Idiomas'),
'fr': dict(
  title='Galeborn : jeu de combat anime gratuit dans le navigateur',
  desc='Galeborn est un jeu de combat anime 3D gratuit, jouable dans le navigateur. Affrontez vos amis ou des joueurs classés en ligne, des bots ou un boss. Sans téléchargement.',
  h1='Galeborn, un jeu de duels élémentaires anime gratuit',
  lead='Galeborn est un jeu de combat anime 3D gratuit qui se lance directement dans votre navigateur, sans téléchargement ni installation. Choisissez un combattant qui maîtrise le vent, le feu, la terre ou l’eau et réglez vos comptes dans des duels en un contre un, rapides et cinématiques.',
  play='Jouer gratuitement', playsub='Fonctionne sur Chrome, Edge, Firefox et Safari',
  modesH='Modes de jeu', modes=[('En ligne classé','Matchmaking contre des joueurs du monde entier, avec rangs, saisons et classement.'),('Contre un ami','Partagez un code de salon ou un lien d’invitation et affrontez un ami en ligne.'),('Contre un bot','Entraînez-vous contre des adversaires IA sur trois niveaux de difficulté.'),('Entraînement','Six leçons sur le déplacement, les combos, la garde, la parade et le burst.'),('Boss en solo','Affrontez Varukh, le Gardien des Cendres, un boss de feu en deux phases.')],
  heroesH='Combattants', heroes=['Combos aériens rapides, dashs et l’ultime Tempest.','Arts martiaux de feu agressifs et enchaînements brûlants.','Frappes de terre lourdes, brise-garde et pics de pierre.','Combos d’eau fluides et contrôle de l’adversaire.'],
  titles=['Le Danseur du Vent','Le Poing Solaire','Le Rempart','L’Invocatrice des Marées'],
  combatH='Combat anime', combat='Projections, combos aériens, parades, brise-garde, duels de rayons, sorties de ring et coups de grâce au ralenti, avec impact frames façon anime et caméra cinématique. Chaque élément a son propre jeu de coups.',
  arenasH='Arènes', arenas='Lantern Strait au coucher du soleil, Thunderhead Spire sous les éclairs et Frostbell Pass dans le blizzard, chacune avec des piliers destructibles.',
  howH='Comment jouer', how='Jouez au clavier et à la souris ou à la manette sur tout ordinateur doté d’un navigateur récent et de WebGL. Galeborn est gratuit : ouvrez le jeu et choisissez En ligne, Contre un ami, Contre un bot, Entraînement ou Boss en solo.',
  faqH='Questions', faq=[('Galeborn est-il gratuit ?','Oui. Galeborn est entièrement gratuit et se joue dans le navigateur.'),('Faut-il télécharger quelque chose ?','Non. Le jeu tourne dans le navigateur. Un fichier optionnel pour jouer hors ligne est aussi proposé sur l’écran titre.'),('Peut-on jouer entre amis ?','Oui. Choisissez Contre un ami et partagez le code du salon ou le lien d’invitation.')],
  langH='Langues'),
'de': dict(
  title='Galeborn: Kostenloses Anime-Kampfspiel im Browser',
  desc='Galeborn ist ein kostenloses 3D-Anime-Kampfspiel für den Browser. Duelliere Freunde oder Ranked-Spieler online, kämpfe gegen Bots oder einen Boss. Kein Download.',
  h1='Galeborn, ein kostenloses Anime-Elementarduell',
  lead='Galeborn ist ein kostenloses 3D-Anime-Kampfspiel, das direkt im Browser läuft, ohne Download oder Installation. Wähle einen Kämpfer, der Wind, Feuer, Erde oder Wasser beherrscht, und tritt in schnellen, filmreifen Eins-gegen-eins-Duellen an.',
  play='Jetzt kostenlos spielen', playsub='Läuft in Chrome, Edge, Firefox und Safari',
  modesH='Spielmodi', modes=[('Online Ranked','Matchmaking gegen Spieler aus aller Welt, mit Rängen, Saisons und Bestenliste.'),('Gegen einen Freund','Teile einen Raumcode oder Einladungslink und duelliere einen Freund online.'),('Gegen einen Bot','Trainiere gegen KI-Gegner in drei Schwierigkeitsstufen.'),('Training','Sechs Lektionen zu Bewegung, Combos, Blocken, Parieren und Burst.'),('Solo-Boss','Stelle dich Varukh, dem Aschewächter, einem Feuerboss mit zwei Phasen.')],
  heroesH='Kämpfer', heroes=['Schnelle Luftcombos, Dashes und das Tempest-Ultimate.','Aggressive Feuer-Kampfkunst und lodernde Combos.','Schwere Erdschläge, Guard Breaks und Steinstacheln.','Fließende Wassercombos und Gegnerkontrolle.'],
  titles=['Der Windtänzer','Die Sonnenfeuerfaust','Der Steinwall','Die Gezeitenruferin'],
  combatH='Anime-Kampf', combat='Launcher, Luftcombos, Paraden, Guard Breaks, Strahlenduelle, Ring-outs und Finisher in Zeitlupe, mit Anime-Impact-Frames und filmischer Kamera. Jedes Element hat sein eigenes Moveset.',
  arenasH='Arenen', arenas='Lantern Strait im Sonnenuntergang, Thunderhead Spire mit Blitzeinschlägen und Frostbell Pass mit Schneesturmböen, jeweils mit zerstörbaren Säulen.',
  howH='So spielst du', how='Spiele mit Tastatur und Maus oder Gamepad auf jedem Computer mit modernem Browser und WebGL. Galeborn ist kostenlos: Öffne das Spiel und wähle Online, Gegen einen Freund, Gegen einen Bot, Training oder Solo-Boss.',
  faqH='Fragen', faq=[('Ist Galeborn kostenlos?','Ja. Galeborn ist komplett kostenlos und läuft im Browser.'),('Muss ich etwas herunterladen?','Nein. Das Spiel läuft im Browser. Optional gibt es auf dem Titelbildschirm eine Datei zum Offline-Spielen.'),('Kann ich mit Freunden spielen?','Ja. Wähle Gegen einen Freund und teile den Raumcode oder Einladungslink.')],
  langH='Sprachen'),
'zh': dict(
  title='Galeborn：免费浏览器动漫格斗游戏',
  desc='Galeborn 是一款免费的 3D 动漫元素格斗游戏，直接在浏览器中游玩。在线与好友或排位玩家对决，挑战机器人或首领。无需下载。',
  h1='Galeborn：免费动漫元素对决游戏',
  lead='Galeborn 是一款免费的 3D 动漫格斗游戏，直接在浏览器中运行，无需下载或安装。选择一位操控风、火、土或水的战士，在快节奏、电影感十足的一对一对决中一决胜负。',
  play='立即免费游玩', playsub='支持 Chrome、Edge、Firefox 和 Safari',
  modesH='游戏模式', modes=[('在线排位','与全球玩家匹配对战，包含段位、赛季和排行榜。'),('好友对战','分享房间代码或邀请链接，与好友在线对决。'),('人机对战','与三种难度的 AI 对手练习。'),('训练','六节课程，教你移动、连招、格挡、招架和爆发。'),('单人首领战','挑战烬之守卫 Varukh，一个拥有两个阶段的火焰首领。')],
  heroesH='战士', heroes=['迅捷的空中连招、冲刺和终极技“暴风”。','凶猛的火焰武术与炽热连段。','沉重的大地打击、破防和石刺。','流畅的水之连招与控场。'],
  titles=['风之舞者','烈阳之拳','磐石之壁','唤潮者'],
  combatH='动漫战斗', combat='挑空、空中连招、招架、破防、光束对拼、场外击飞和慢镜头终结技，配合动漫冲击帧与电影化镜头。每种元素都有独特的招式和克制关系。',
  arenasH='竞技场', arenas='夕阳下的 Lantern Strait、雷电交加的 Thunderhead Spire、暴风雪中的 Frostbell Pass，每个竞技场都有可破坏的石柱。',
  howH='如何游玩', how='在任何支持 WebGL 的现代浏览器电脑上，使用键盘鼠标或手柄游玩。Galeborn 完全免费：打开游戏，选择在线、好友对战、人机对战、训练或单人首领战。',
  faqH='常见问题', faq=[('Galeborn 免费吗？','是的，Galeborn 完全免费，在浏览器中即可游玩。'),('需要下载吗？','不需要。游戏在浏览器中运行。标题画面也提供可选的离线版文件。'),('可以和朋友一起玩吗？','可以。选择“好友对战”，然后分享房间代码或邀请链接。')],
  langH='语言'),
}
HEROES = [('Tavi', 'wind', '#22e6ff'), ('Soren', 'fire', '#ff6a1a'), ('Brannoc', 'earth', '#c9a24a'), ('Ysra', 'water', '#3d8bff')]

CSS = '''@font-face{font-family:Anton;font-display:swap;src:url(/fonts/anton.woff2) format('woff2')}
:root{--bg:#0d0b12;--panel:#160f2a;--ink:#f4ecdf;--mut:#b9b0c9;--mag:#ff3d9a;--cy:#22e6ff}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 "Segoe UI",system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
a{color:var(--cy)}main{max-width:960px;margin:0 auto;padding:0 16px 48px}
.hero{display:grid;grid-template-columns:1.2fr .8fr;gap:24px;align-items:center;padding:32px 0 8px}
.logo{font:64px/0.9 Anton,Impact,sans-serif;font-style:italic;letter-spacing:.02em;margin:0;color:#fff;text-shadow:4px 4px 0 var(--mag),-2px -2px 0 var(--cy)}
h1{font-size:26px;line-height:1.25;margin:14px 0 10px}h2{font:26px/1.2 Anton,Impact,sans-serif;letter-spacing:.03em;margin:40px 0 12px;color:#fff;border-left:5px solid var(--mag);padding-left:12px}
.lead{color:var(--mut);font-size:17px}.cta{display:inline-block;margin:18px 0 4px;padding:14px 30px;background:linear-gradient(90deg,var(--mag),#8a3dff);color:#fff;font-weight:900;font-size:19px;letter-spacing:.08em;text-decoration:none;text-transform:uppercase;transform:skewX(-10deg);box-shadow:6px 6px 0 var(--cy)}
.cta:hover{filter:brightness(1.15)}.sub{font-size:13px;color:var(--mut)}
.shot img{width:100%;height:auto;display:block;border:2px solid var(--cy);box-shadow:0 0 30px rgba(255,61,154,.45)}
ul.modes{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
ul.modes li{background:var(--panel);padding:14px 16px;border-left:4px solid var(--cy)}
.fighters{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px}
.f{background:var(--panel);padding:12px;text-align:center;border-top:4px solid var(--c)}.f img{height:220px;width:auto;max-width:100%}
.f h3{margin:6px 0 0;font:24px Anton,Impact,sans-serif;letter-spacing:.03em}.f small{display:block;color:var(--c);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px}.f p{margin:6px 0 0;font-size:14px;color:var(--mut)}
dl dt{font-weight:700;margin-top:12px}dl dd{margin:2px 0 0;color:var(--mut)}
footer{max-width:960px;margin:0 auto;padding:16px 16px 40px;color:var(--mut);font-size:14px;border-top:1px solid #2a2140}
footer a{margin-right:14px}
@media (max-width:720px){.hero{grid-template-columns:1fr}.logo{font-size:48px}}'''

def page(code):
    t = T[code]; e = html.escape
    path = next(p for c, p, _, _ in LANGS if c == code); lang = next(l for c, _, _, l in LANGS if c == code)
    url = f'{SITE}/{path}/'
    alts = ''.join(f'<link rel="alternate" hreflang="{h}" href="{SITE}/{p}/">\n' for c, p, h, _ in LANGS) + f'<link rel="alternate" hreflang="x-default" href="{SITE}/about/">\n'
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "@id": url, "url": url, "name": t['title'], "description": t['desc'], "inLanguage": lang, "about": {"@id": SITE + "/#game"}},
        {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in t['faq']]}]}
    modes = ''.join(f'<li><b>{e(n)}</b><br>{e(d)}</li>' for n, d in t['modes'])
    fighters = ''.join(f'<div class="f" style="--c:{c}"><img src="/img/{el}.webp" alt="{n}, {e(tt)}" width="445" height="900" loading="lazy"><h3>{n}</h3><small>{e(tt)}</small><p>{e(d)}</p></div>'
                       for (n, el, c), tt, d in zip(HEROES, t['titles'], t['heroes']))
    faq = ''.join(f'<dt>{e(q)}</dt><dd>{e(a)}</dd>' for q, a in t['faq'])
    langs = ''.join(f'<a href="/{p}/" hreflang="{h}" lang="{l}">{NAMES[c]}</a>' for c, p, h, l in LANGS)
    return f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(t['title'])}</title>
<meta name="description" content="{e(t['desc'])}">
<link rel="canonical" href="{url}">
{alts}<meta name="theme-color" content="#120b24">
<link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website"><meta property="og:site_name" content="Galeborn"><meta property="og:url" content="{url}">
<meta property="og:title" content="{e(t['title'])}"><meta property="og:description" content="{e(t['desc'])}">
<meta property="og:image" content="{SITE}/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{SITE}/og.jpg">
<link rel="preload" href="/fonts/anton.woff2" as="font" type="font/woff2" crossorigin>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>{CSS}</style>
</head>
<body>
<main>
<section class="hero">
<div>
<p class="logo">GALEBORN</p>
<h1>{e(t['h1'])}</h1>
<p class="lead">{e(t['lead'])}</p>
<a class="cta" href="/">{e(t['play'])}</a>
<div class="sub">{e(t['playsub'])}</div>
</div>
<div class="shot"><img src="/og.jpg" alt="Galeborn" width="1200" height="630"></div>
</section>
<h2>{e(t['modesH'])}</h2><ul class="modes">{modes}</ul>
<h2>{e(t['heroesH'])}</h2><div class="fighters">{fighters}</div>
<h2>{e(t['combatH'])}</h2><p>{e(t['combat'])}</p>
<h2>{e(t['arenasH'])}</h2><p>{e(t['arenas'])}</p>
<h2>{e(t['howH'])}</h2><p>{e(t['how'])}</p><a class="cta" href="/">{e(t['play'])}</a>
<h2>{e(t['faqH'])}</h2><dl>{faq}</dl>
</main>
<footer><b>{e(t['langH'])}:</b> {langs}<br><a href="/">playgaleborn.fun</a></footer>
</body>
</html>
'''

if __name__ == '__main__':
    root = os.path.join(os.path.dirname(__file__), '..')
    seo = os.path.join(root, 'seo')
    for c, p, _, _ in LANGS:
        os.makedirs(f'{seo}/{p}', exist_ok=True)
        open(f'{seo}/{p}/index.html', 'w').write(page(c))
    os.makedirs(f'{seo}/img', exist_ok=True); os.makedirs(f'{seo}/fonts', exist_ok=True)
    for _, el, _ in HEROES: shutil.copy(f'{root}/assets/art/body_{el}.webp', f'{seo}/img/{el}.webp')
    shutil.copy(f'{root}/assets/fonts/Anton_400_normal.woff2', f'{seo}/fonts/anton.woff2')
    # sitemap with hreflang alternates
    alt = ''.join(f'    <xhtml:link rel="alternate" hreflang="{h}" href="{SITE}/{p}/"/>\n' for _, p, h, _ in LANGS) + f'    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE}/about/"/>\n'
    urls = f'  <url>\n    <loc>{SITE}/</loc>\n    <lastmod>2026-11-16</lastmod>\n  </url>\n' + ''.join(
        f'  <url>\n    <loc>{SITE}/{p}/</loc>\n    <lastmod>2026-11-16</lastmod>\n{alt}  </url>\n' for _, p, _, _ in LANGS)
    open(f'{seo}/sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + urls + '</urlset>\n')
    print('wrote', [p for _, p, _, _ in LANGS])
