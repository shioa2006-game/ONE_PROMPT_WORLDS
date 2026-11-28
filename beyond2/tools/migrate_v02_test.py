# GUILDWARD — v0.2 の保存データから、v0.3 の第二章へ進めるかの確認（Playwright + Edge ヘッドレス。人の保存データには触れない）
# 使い方:
#   git archive aaa4da5 beyond2 | tar -x -C <作業用フォルダ>      … v0.2 のゲーム本体を取りだす（aaa4da5 は v0.2 のコミット）
#   python tools/migrate_v02_test.py --v02 <作業用フォルダ>/beyond2 [--shots DIR]
# 手順：
#   1. まっさらなブラウザ（Playwright の新しい文脈。保存は空）で v0.2 を開き、v0.2 のコードで「第一章の結末まで見た」記録をつくる
#      （依頼1〜6を達成・印・お守り・道具。ギルドで保存）
#   2. 同じ文脈で v0.3 を開く。「つづきから」→ ギルド → 依頼板に m7 が貼られ、予告の札は消えている。m7 を受けて出発できる
#   3. v0.2 の「依頼のつづき」（依頼5の途中）も、v0.3 でそのまま再開できる（保存の形は v: 2 のまま）
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = 'beyond2_guildward_save'


def url(d):
    return 'file:///' + os.path.join(d, 'index.html').replace('\\', '/')


def main():
    args = sys.argv[1:]
    v02 = args[args.index('--v02') + 1]
    shots = args[args.index('--shots') + 1] if '--shots' in args else None
    if shots:
        os.makedirs(shots, exist_ok=True)
    errs = []
    res = []

    def ok(c, msg):
        res.append((bool(c), msg))
        print(('OK  ' if c else 'NG  ') + msg)

    def click_btn(pg, key):
        pg.wait_for_timeout(200)
        bs = pg.evaluate('G21.buttons()')
        hit = [b for b in bs if b['key'] == key]
        if not hit:
            return False
        r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
        pg.mouse.click(r[0] + hit[-1]['x'] * r[2], r[1] + hit[-1]['y'] * r[2])
        return True

    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        ctx = br.new_context(viewport={'width': 1280, 'height': 720})
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        # ---- 1. v0.2 で「第一章の結末まで見た」記録をつくる ----
        pg.goto(url(v02))
        pg.wait_for_timeout(600)
        ok(pg.evaluate(f'!localStorage.getItem("{KEY}")'), 'はじめは保存がない（まっさらなブラウザ）')
        v2 = pg.evaluate('''(() => {
          const S = window.S21, D = window.D21, C = window.C21, A = window.APP21;
          const p = C.newProfile();
          A.G.prof = p;
          const fake = (id, party) => { const st = S.create(D.MAPS[D.req(id).map], C.carry(p, party, id)); st.flags.cleared = true; return st; };
          for (const [id, party] of [['m1', ['gard', 'sena']], ['m2', ['gard', 'sena']], ['m3', ['gard', 'sena']], ['m4', ['sena', 'tobi']], ['m5', ['gard', 'tobi']], ['m6', ['gard', 'sena']]]) C.complete(p, id, fake(id, party));
          p.charms.push('c_tag'); p.equip.riko = 'c_tag'; p.stamps.m1a = true; p.stamps.m2b = true; p.stamps.m6b = true;
          C.buy(p, 'bow');
          window.G21.guild();
          A.save();
          return JSON.parse(localStorage.getItem('beyond2_guildward_save'));
        })()''')
        ok(v2 and v2['v'] == 2 and v2['prof']['chapterDone'] and not v2.get('play'), 'v0.2 の記録：v=2、第一章の結末まで見た（ギルドで保存）')
        ok(v2['prof']['merit'] == 11 and v2['prof']['roster'] == ['gard', 'sena', 'tobi'], 'v0.2 の記録：功績11（★4）・仲間はガルド・セナ・トビ')
        if shots:
            pg.screenshot(path=os.path.join(shots, 'v02_saved.png'))
        # ---- 2. v0.3 を開いて、第二章へ ----
        pg.goto(url(ROOT))
        pg.wait_for_timeout(900)
        raw0 = pg.evaluate(f'localStorage.getItem("{KEY}")')
        ok(json.loads(raw0) == v2, 'タイトルを見ただけでは、保存は書きかえない')
        bs = pg.evaluate('G21.buttons()')
        cont = [b for b in bs if b['key'] == 'cont']
        ok(cont and 'ギルド' in cont[0]['label'], 'タイトル：「つづきから（ギルド…）」 → ' + (cont[0]['label'] if cont else '-'))
        click_btn(pg, 'cont')
        pg.wait_for_timeout(1500)
        ok(pg.evaluate('G21.scene()') == 'guild', 'つづきから → ギルド')
        prof = pg.evaluate('G21.prof()')
        ok(prof['v'] == 2 and prof['chapterDone'] and prof['merit'] == 11 and prof['coins'] == v2['prof']['coins'] and prof['stamps'] == v2['prof']['stamps'] and prof['equip'] == v2['prof']['equip'], '記録はそのまま（v=2・功績・銀貨・印・お守り）')
        fresh = pg.evaluate('G21.C.board(G21.prof()).filter(x => x.fresh).map(x => x.r.id)')
        ok(fresh == ['m7'], '依頼板をひらく前：「NEW」は m7 だけ → ' + json.dumps(fresh))
        click_btn(pg, 'h_board')
        pg.wait_for_timeout(500)
        keys = [b['key'] for b in pg.evaluate('G21.buttons()')]
        ok('req_m7' in keys, '依頼板：第二章の最初の依頼「峠の茶屋の荷」(m7) が貼られている')
        ok('req_ch2' not in keys, '依頼板：第二章の予告の札は、m7 に置きかわった')
        ok('req_m8' not in keys, '依頼板：m8 は、まだ（m7 のあと）')
        click_btn(pg, 'req_m7')
        pg.wait_for_timeout(300)
        if shots:
            pg.screenshot(path=os.path.join(shots, 'v03_board_m7.png'))
        click_btn(pg, 'take')
        pg.wait_for_timeout(500)
        ok(pg.evaluate('HUB21.debug().panel') == 'party', '「だれと行く？」がひらく')
        if shots:
            pg.screenshot(path=os.path.join(shots, 'v03_party_m7.png'))
        click_btn(pg, 'depart')
        pg.wait_for_timeout(2500)
        ok(pg.evaluate('G21.scene()') == 'play' and pg.evaluate('G21.state().sec') == 'm7', '出発 → m7 の地図')
        ok(not pg.evaluate("G21.S.can(G21.state(), 'riko', 'pull')"), 'はじめは引き鉤を持っていない（地図の宝箱で手に入れる）')
        ok(pg.evaluate("G21.state().units.find(u => u.id === 'riko').charm") == 'c_tag', 'v0.2 で持たせたお守り（木札）は、そのまま持っていく')
        pg.evaluate('G21.setOpt({ fast: true })')
        for _ in range(80):
            if not pg.evaluate('G21.busy()'):
                break
            pg.wait_for_timeout(100)
        pg.evaluate("G21.act('riko', { k: 'shoot', ref: { o: 'icA' } })")
        pg.wait_for_timeout(2500)
        saved = json.loads(pg.evaluate(f'localStorage.getItem("{KEY}")'))
        ok(saved['v'] == 2 and saved['play'] and saved['play']['req'] == 'm7', '依頼の途中の保存（v=2・m7）')
        ok(saved['play'] and saved['play']['st']['t'][10 * 14 + 6] == 'i', '保存に、つららでできた氷の飛び石 (6,10) も入っている')
        pg.reload(); pg.wait_for_timeout(900)
        click_btn(pg, 'cont'); pg.wait_for_timeout(1800)
        ok(pg.evaluate('G21.scene()') == 'play' and pg.evaluate("G21.state().t[G21.S.idx(G21.state(), 6, 10)]") == 'i' and pg.evaluate("!!G21.S.objById(G21.state(), 'icA').gone"), '読みなおして「依頼のつづき」：m7 の飛び石のまま再開')
        if shots:
            pg.screenshot(path=os.path.join(shots, 'v03_m7_start.png'))
        # ---- 3. v0.2 の「依頼のつづき」を v0.3 で再開 ----
        ctx2 = br.new_context(viewport={'width': 1280, 'height': 720})
        pg2 = ctx2.new_page()
        pg2.on('pageerror', lambda e: errs.append(str(e)))
        pg2.goto(url(v02))
        pg2.wait_for_timeout(600)
        pg2.evaluate('''(() => {
          const S = window.S21, D = window.D21, C = window.C21, A = window.APP21;
          const p = C.newProfile(); A.G.prof = p;
          const fake = (id, party) => { const st = S.create(D.MAPS[D.req(id).map], C.carry(p, party, id)); st.flags.cleared = true; return st; };
          for (const [id, party] of [['m1', ['gard', 'sena']], ['m2', ['gard', 'sena']], ['m3', ['gard', 'sena']]]) C.complete(p, id, fake(id, party));
          window.G21.setOpt({ fast: true });
          window.G21.mission('m5', ['gard', 'tobi']);
          return 1;
        })()''')
        pg2.wait_for_timeout(2500)
        for _ in range(80):
            if not pg2.evaluate('G21.busy()'):
                break
            pg2.wait_for_timeout(100)
        pg2.evaluate("G21.act('riko', { k: 'shoot', ref: { u: 'e1' } })")
        pg2.wait_for_timeout(1800)
        before = pg2.evaluate("JSON.stringify([G21.state().turn, G21.state().units.map(u => [u.id, u.x, u.y, u.hp, u.acted]), G21.state().raid])")
        sv = json.loads(pg2.evaluate(f'localStorage.getItem("{KEY}")'))
        ok(sv['v'] == 2 and sv['play'] and sv['play']['req'] == 'm5', 'v0.2 の依頼の途中の保存（依頼5の戦いの途中）')
        pg2.goto(url(ROOT))
        pg2.wait_for_timeout(900)
        bs = pg2.evaluate('G21.buttons()')
        cont = [b for b in bs if b['key'] == 'cont']
        ok(cont and '依頼のつづき' in cont[0]['label'], 'v0.3 のタイトル：「依頼のつづきから（…）」 → ' + (cont[0]['label'] if cont else '-'))
        click_btn(pg2, 'cont')
        pg2.wait_for_timeout(1800)
        after = pg2.evaluate("JSON.stringify([G21.state().turn, G21.state().units.map(u => [u.id, u.x, u.y, u.hp, u.acted]), G21.state().raid])")
        ok(pg2.evaluate('G21.scene()') == 'play' and after == before, 'v0.3 で、v0.2 の依頼の途中から再開：手番・人の位置・体力・米俵が同じ')
        pg2.evaluate("G21.endTurn()")
        pg2.wait_for_timeout(2500)
        ok(pg2.evaluate('G21.state().turn') >= 2, '再開したあと、手番を終えて続けられる')
        if shots:
            pg2.screenshot(path=os.path.join(shots, 'v03_resumed_v02_m5.png'))
        br.close()
    n_ng = sum(1 for c, _ in res if not c)
    print('pass', len(res) - n_ng, 'fail', n_ng)
    print('ERRORS:', *errs[:10], sep='\n  ') if errs else print('no page errors')
    sys.exit(1 if n_ng or errs else 0)


if __name__ == '__main__':
    main()
