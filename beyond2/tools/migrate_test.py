# GUILDWARD — v0.1 の保存データを v0.2 で読みこめるかの確認（Playwright + Edge ヘッドレス。人の保存データには触れない）
# 使い方:
#   git archive abb2b75 beyond2 | tar -x -C <作業用フォルダ>      … v0.1 のゲーム本体を取りだす（abb2b75 は v0.1 の最後のコミット）
#   python tools/migrate_test.py --v01 <作業用フォルダ>/beyond2 [--shots DIR]
# 手順：
#   1. まっさらなブラウザ（Playwright の新しい文脈。保存は空）で v0.1 を開き、v0.1 のコードで第一章の途中まで進めた記録をつくる
#      （依頼1〜5を達成・受けなおし・道具・銀貨。最後に依頼6の途中で保存＝「依頼のつづき」）
#   2. 同じ文脈で v0.2 を開く（file:// なので localStorage は同じ場所）。タイトルの表示・「つづきから」・移行後の記録を確かめる
#   3. v0.2 で保存しなおした記録の形、依頼の途中の保存と再開（v0.2 の形）も確かめる
import json, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = 'beyond2_guildward_save'


def url(d):
    return 'file:///' + os.path.join(d, 'index.html').replace('\\', '/')


def main():
    args = sys.argv[1:]
    v01 = args[args.index('--v01') + 1]
    shots = args[args.index('--shots') + 1] if '--shots' in args else None
    if shots:
        os.makedirs(shots, exist_ok=True)
    errs = []
    res = []

    def ok(c, msg):
        res.append((bool(c), msg))
        print(('OK  ' if c else 'NG  ') + msg)

    with sync_playwright() as p:
        br = p.chromium.launch(channel='msedge')
        ctx = br.new_context(viewport={'width': 1280, 'height': 720})
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        # ---- 1. v0.1 で記録をつくる ----
        pg.goto(url(v01))
        pg.wait_for_timeout(600)
        ok(pg.evaluate('!localStorage.getItem("beyond2_guildward_save")'), 'はじめは保存がない（まっさらなブラウザ）')
        v1 = pg.evaluate('''(() => {
          const S = window.S21, D = window.D21, C = window.C21, A = window.APP21;
          const p = C.newProfile();
          A.G.prof = p;
          const fake = (id, party) => { const st = S.create(D.MAPS[D.req(id).map], C.carry(p, party)); st.flags.cleared = true; st.coins = id === 'm1' ? 30 : id === 'm2' ? 40 : 0; st.found = st.coins ? ['x'] : []; return st; };
          C.complete(p, 'm1', fake('m1', ['gard', 'sena']));
          C.complete(p, 'm2', fake('m2', ['gard', 'sena']));
          C.complete(p, 'm3', fake('m3', ['gard', 'sena']));
          C.complete(p, 'm4', fake('m4', ['sena', 'tobi']));
          C.complete(p, 'm4', fake('m4', ['gard', 'tobi']));   // 受けなおし（v0.1 では宝箱を取りなおせた）
          C.complete(p, 'm5', fake('m5', ['gard', 'tobi']));
          C.buy(p, 'bow');
          p.time = 1800;
          window.G21.mission('m6', ['gard', 'sena']);         // 依頼6の途中で保存（依頼のつづき）
          A.save();
          return JSON.parse(localStorage.getItem('beyond2_guildward_save'));
        })()''')
        ok(v1 and v1['v'] == 1 and v1['play'] and v1['play']['req'] == 'm6', 'v0.1 の記録：v=1、依頼6の途中の保存つき')
        ok(v1['prof']['merit'] == 8 and 'tobi' in v1['prof']['roster'] and v1['prof']['up'].get('bow'), 'v0.1 の記録：功績8・トビ加入・長弓')
        if shots:
            pg.screenshot(path=os.path.join(shots, 'm0_v01_saved.png'))
        # ---- 2. v0.2 を開く ----
        pg.goto(url(ROOT))
        pg.wait_for_timeout(900)
        ok(pg.evaluate('document.title') == 'GUILDWARD', 'v0.2 を開く')
        raw0 = pg.evaluate(f'localStorage.getItem("{KEY}")')
        ok(json.loads(raw0)['v'] == 1, 'タイトルを見ただけでは、保存は書きかえない（v=1 のまま）')
        bs = pg.evaluate('G21.buttons()')
        cont = [b for b in bs if b['key'] == 'cont']
        ok(cont and 'ギルド' in cont[0]['label'] and '依頼のつづき' not in cont[0]['label'], 'タイトル：「つづきから（ギルド・…）」になる（依頼のつづきではない） → ' + (cont[0]['label'] if cont else '-'))
        if shots:
            pg.screenshot(path=os.path.join(shots, 'm1_title_migrated.png'))
        sv = pg.evaluate('G21.loadSave()')
        ok(sv['migratedPlay'] and sv['play'] is None, 'タイトル：「前の版の『依頼のつづき』は、ギルドからの再開になります」を出す条件')
        # 本物のクリックで「つづきから」
        r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
        pg.mouse.click(r[0] + cont[0]['x'] * r[2], r[1] + cont[0]['y'] * r[2])
        pg.wait_for_timeout(1500)
        ok(pg.evaluate('G21.scene()') == 'guild', 'つづきから → ギルドから再開')
        prof = pg.evaluate('G21.prof()')
        ok(prof['v'] == 2, '移行後の記録：v=2')
        ok(prof['coins'] == v1['prof']['coins'] and prof['merit'] == 8 and prof['roster'] == v1['prof']['roster'] and prof['up'] == v1['prof']['up'] and prof['trophies'] == v1['prof']['trophies'], '銀貨・功績・仲間・道具・飾り棚はそのまま')
        ok(prof['done'].keys() == v1['prof']['done'].keys() and prof['partyLog'] == v1['prof']['partyLog'], '達成の記録・攻略した編成はそのまま')
        ok(prof['stamps'] == {} and prof['charms'] == [] and prof['equip'] == {} and prof['ledger'] == {}, '印・お守り・持たせ方・腕だめし帳は空')
        ok(prof['chests'] == {'m1': ['o3'], 'm2': ['o5'], 'm3': ['o5'], 'm4': ['o2'], 'm5': []}, '達成ずみの依頼の宝箱は、持ち帰ったものとして埋まる → ' + json.dumps(prof['chests']))
        ok(prof['firstParty'] == {'m1': 'gard+sena', 'm2': 'gard+sena', 'm3': 'gard+sena', 'm4': 'sena+tobi', 'm5': 'gard+tobi'}, '初回の二人は partyLog の最初から → ' + json.dumps(prof['firstParty']))
        ok(prof['rank'] == 3, 'ランク★3（功績8）')
        saved = json.loads(pg.evaluate(f'localStorage.getItem("{KEY}")'))
        ok(saved['v'] == 2 and saved['play'] is None and saved['prof']['v'] == 2, 'ギルドに入ると、v0.2 の形で保存しなおす（依頼の途中の保存はない）')
        if shots:
            pg.screenshot(path=os.path.join(shots, 'm2_guild_after_migration.png'))
        # 依頼板：大亀は受けられる、印の◇が出る
        pg.evaluate("HUB21.debug && 0")
        bs = pg.evaluate('G21.buttons()')
        board = [b for b in bs if b['key'] == 'h_board'][0]
        pg.mouse.click(r[0] + board['x'] * r[2], r[1] + board['y'] * r[2]); pg.wait_for_timeout(500)
        keys = [b['key'] for b in pg.evaluate('G21.buttons()')]
        ok('req_m6' in keys and 'req_m4' in keys, '依頼板：移行した記録のまま、大亀の依頼まで並ぶ')
        if shots:
            pg.screenshot(path=os.path.join(shots, 'm3_board_after_migration.png'))
        # 受けなおしの宝箱は空
        empty = pg.evaluate("(() => { const p = G21.prof(); const st = G21.S.create(G21.D.MAPS.m1, G21.C.carry(p, ['gard', 'sena'], 'm1')); return G21.S.objById(st, 'o3').taken === true; })()")
        ok(empty, '移行した記録で受けなおすと、宝箱は空')
        # ---- 3. v0.2 の依頼の途中の保存と再開 ----
        pg.evaluate("G21.mission('m6', ['gard', 'tobi'])")
        pg.wait_for_timeout(2500)
        pg.evaluate("G21.setOpt({fast: true})")
        for _ in range(60):
            if not pg.evaluate('G21.busy()'):
                break
            pg.wait_for_timeout(100)
        pg.evaluate("G21.act('riko', { k: 'shoot', ref: { u: 'e2' } })")
        pg.wait_for_timeout(1500)
        before = pg.evaluate("JSON.stringify([G21.state().turn, G21.state().units.map(u => [u.id, u.x, u.y, u.hp, u.acted])])")
        saved = json.loads(pg.evaluate(f'localStorage.getItem("{KEY}")'))
        ok(saved['v'] == 2 and saved['play'] and saved['play']['req'] == 'm6', 'v0.2 の依頼の途中の保存（v=2・依頼6）')
        pg.reload(); pg.wait_for_timeout(900)
        bs = pg.evaluate('G21.buttons()')
        cont = [b for b in bs if b['key'] == 'cont']
        ok(cont and '依頼のつづき' in cont[0]['label'], 'タイトル：「依頼のつづきから（岩喰い大亀）」 → ' + (cont[0]['label'] if cont else '-'))
        r = pg.evaluate("(() => { const r = document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width / 1280]; })()")
        pg.mouse.click(r[0] + cont[0]['x'] * r[2], r[1] + cont[0]['y'] * r[2])
        pg.wait_for_timeout(1800)
        after = pg.evaluate("JSON.stringify([G21.state().turn, G21.state().units.map(u => [u.id, u.x, u.y, u.hp, u.acted])])")
        ok(pg.evaluate('G21.scene()') == 'play' and after == before, '依頼の途中から再開：手番・人の位置・体力・行動ずみが同じ')
        if shots:
            pg.screenshot(path=os.path.join(shots, 'm4_resumed_v02_play.png'))
        br.close()
    n_ng = sum(1 for c, _ in res if not c)
    print('pass', len(res) - n_ng, 'fail', n_ng)
    print('ERRORS:', *errs[:10], sep='\n  ') if errs else print('no page errors')
    sys.exit(1 if n_ng or errs else 0)


if __name__ == '__main__':
    main()
