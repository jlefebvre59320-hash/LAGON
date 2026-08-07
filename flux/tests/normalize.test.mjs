import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanTitle, extractCodes, isIgnored, normalizeSample, parseUrl, signature, tokenize } from '../server/normalize.mjs'

test('parseUrl retire www et les paramètres de suivi', () => {
  const { domain, path } = parseUrl('https://www.Airtable.com/appXY/tblZ?utm_source=slack&view=grid')
  assert.equal(domain, 'airtable.com')
  assert.ok(path.includes('view=grid'))
  assert.ok(!path.includes('utm_source'))
})

test('parseUrl ne casse pas sur une URL non http ni sur du texte', () => {
  assert.equal(parseUrl('vscode://file/home/projet').domain, 'vscode')
  assert.equal(parseUrl('pas une url').domain, '')
  assert.deepEqual(parseUrl(undefined), { domain: '', path: '', url: '' })
})

test('cleanTitle enlève le compteur de notifications et le suffixe du navigateur', () => {
  assert.equal(cleanTitle('(3) Slack | équipe - Google Chrome'), 'Slack | équipe')
})

test('extractCodes repère les tickets et codes métier', () => {
  const codes = extractCodes('T15423 — migration switch EROCAM401 (ABC-42)')
  assert.ok(codes.includes('t15423'))
  assert.ok(codes.includes('erocam401'))
  assert.ok(codes.includes('abc-42'))
})

test('tokenize écarte les mots vides, les accents et les nombres nus', () => {
  const tokens = tokenize('Réunion de préparation pour le déploiement 2026')
  assert.ok(tokens.includes('reunion'))
  assert.ok(tokens.includes('deploiement'))
  assert.ok(!tokens.includes('pour'))
  assert.ok(!tokens.includes('2026'))
})

test('la signature recolle les pages d’un même espace mais sépare deux titres', () => {
  const a = normalizeSample({ url: 'https://airtable.com/appX/tbl1', title: 'Assets' })
  const b = normalizeSample({ url: 'https://airtable.com/appX/tbl2', title: 'Assets' })
  const c = normalizeSample({ url: 'https://airtable.com/appX/tbl1', title: 'Câblage' })
  assert.equal(signature(a), signature(b))
  assert.notEqual(signature(a), signature(c))
})

test('isIgnored couvre le joker, le domaine et le nom d’application', () => {
  const banque = normalizeSample({ url: 'https://client.credit.bank/comptes', title: 'Mes comptes' })
  assert.equal(isIgnored(banque, ['*.bank']), true)
  const signal = normalizeSample({ app: 'Signal', title: 'Messages' })
  assert.equal(isIgnored(signal, ['Signal']), true)
  const travail = normalizeSample({ url: 'https://github.com/org/repo', title: 'repo' })
  assert.equal(isIgnored(travail, ['*.bank', 'Signal']), false)
})

test('normalizeSample refuse une source inventée et retombe sur le navigateur', () => {
  assert.equal(normalizeSample({ source: 'n’importe quoi', title: 'x' }).source, 'browser')
  assert.equal(normalizeSample({ source: 'agent', title: 'x' }).source, 'agent')
})
