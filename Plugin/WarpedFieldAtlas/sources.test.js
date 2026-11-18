'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const { DatabaseSync } = require('node:sqlite');
const { openLibrary } = require('./lib/library');

test('file evidence is directional, bounded and optional', t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-source-test-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const db = new DatabaseSync(path.join(dir, 'knowledge_base.sqlite'));
    db.exec(`CREATE TABLE files(id INTEGER, diary_name TEXT, path TEXT);
        INSERT INTO files VALUES(1,'test','dir/a'),(2,'test','dir/b'),(3,'test','dir/c');
        CREATE TABLE rivermemo_artifacts(artifact_sig TEXT,status TEXT,payload_codec TEXT,payload BLOB);`);
    const insert = db.prepare("INSERT INTO rivermemo_artifacts VALUES(?,'ready','gzip-json-v1',?)");
    const payload = { sharedTransport: { nodeIds: [1, 2], rowOffsets: [0, 1, 2], targetIndices: [1, 0], weights: [1, 1] } };
    insert.run('old', gzipSync(JSON.stringify(payload)));
    payload.provenanceView = { edges: [['1:2', [[1, 1], [9, 99], [2, 5], [3, 4]]], ['2:1', [[1, 'old', 'unused', 4]]]] };
    insert.run('new', gzipSync(JSON.stringify(payload)));
    db.close();
    const lib = openLibrary(dir);
    try {
        const net = lib.riverNetwork('new');
        assert.deepEqual(net.sources(1, 2).map(f => f.name), ['b', 'c']);
        assert.deepEqual(net.sources(2, 1), [{diary:'test', name:'a'}]);
        assert.deepEqual(lib.riverNetwork('old').sources(1, 2), []);
    } finally { lib.close(); }
});