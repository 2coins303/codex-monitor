import test from 'node:test';
import assert from 'node:assert/strict';
import {initialSession,sessionUrl} from '../public/session.js';

test('fresh views and legacy session links automatically follow active chats',()=>{
  assert.equal(initialSession(''),'auto');
  assert.equal(initialSession('?session=old-chat'),'auto');
  assert.equal(initialSession('?session=old-chat&follow=auto'),'auto');
  assert.equal(initialSession('?follow=pinned'),'auto');
  assert.equal(sessionUrl(initialSession('?session=old-chat')),'/');
});

test('only a deliberate pin persists in its own link; auto-follow removes it',()=>{
  const link=sessionUrl('example-chat');
  assert.equal(initialSession(link.slice(1)),'example-chat');
  assert.match(link,/follow=pinned/);
  assert.equal(sessionUrl('auto'),'/');
});
