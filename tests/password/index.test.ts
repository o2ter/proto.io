//
//  index.test.ts
//
//  The MIT License
//  Copyright (c) 2021 - 2025 O2ter Limited. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//

import { masterUser } from './server';
import { test, expect } from '@jest/globals';
import { ProtoClient } from '../../src/client/proto';

const Proto = new ProtoClient({
  endpoint: 'http://localhost:8081/proto',
  masterUser,
});

test('test password policy - custom validator enforcement', async () => {
  const user = await Proto.run('createTestUser');
  
  // Test password too short (less than 8 characters)
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'Pass1' }))
    .rejects.toThrow('Password does not meet the policy requirements');
  
  // Test password without uppercase letter
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'password123' }))
    .rejects.toThrow('Password does not meet the policy requirements');
  
  // Test password without lowercase letter
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'PASSWORD123' }))
    .rejects.toThrow('Password does not meet the policy requirements');
  
  // Test password without digit
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'Password' }))
    .rejects.toThrow('Password does not meet the policy requirements');
  
  // Test valid password that meets all requirements
  await Proto.run('setPassword', { userId: user.id, password: 'Password123' });
  const isValid = await Proto.run('verifyPassword', { userId: user.id, password: 'Password123' });
  expect(isValid).toBe(true);
});

test('test password policy - password history prevention', async () => {
  const user = await Proto.run('createTestUser');
  
  // Set initial password
  await Proto.run('setPassword', { userId: user.id, password: 'Password123' });
  
  // Change password to second password
  await Proto.run('setPassword', { userId: user.id, password: 'Password456' });
  
  // Change password to third password
  await Proto.run('setPassword', { userId: user.id, password: 'Password789' });
  
  // Try to reuse the first password (should fail because it's in history)
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'Password123' }))
    .rejects.toThrow('Cannot reuse previous passwords');
  
  // Try to reuse the second password (should fail because it's in history)
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'Password456' }))
    .rejects.toThrow('Cannot reuse previous passwords');
  
  // Try to reuse the current password (should fail because it's in history)
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'Password789' }))
    .rejects.toThrow('Cannot reuse previous passwords');
  
  // Set a new fourth password (should succeed)
  await Proto.run('setPassword', { userId: user.id, password: 'Password000' });
  const isValid = await Proto.run('verifyPassword', { userId: user.id, password: 'Password000' });
  expect(isValid).toBe(true);
});

test('test password policy - password history limit', async () => {
  const user = await Proto.run('createTestUser');
  
  // Set initial password
  await Proto.run('setPassword', { userId: user.id, password: 'Password111' });
  
  // Change password 3 more times (maxPasswordHistory is 3)
  await Proto.run('setPassword', { userId: user.id, password: 'Password222' });
  await Proto.run('setPassword', { userId: user.id, password: 'Password333' });
  await Proto.run('setPassword', { userId: user.id, password: 'Password444' });
  
  // Now the first password should have fallen out of history
  // So we should be able to reuse it
  await Proto.run('setPassword', { userId: user.id, password: 'Password111' });
  const isValid = await Proto.run('verifyPassword', { userId: user.id, password: 'Password111' });
  expect(isValid).toBe(true);
  
  // But Password222, Password333, and Password444 should still be in history
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'Password222' }))
    .rejects.toThrow('Cannot reuse previous passwords');
  
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'Password333' }))
    .rejects.toThrow('Cannot reuse previous passwords');
  
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'Password444' }))
    .rejects.toThrow('Cannot reuse previous passwords');
});

test('test password policy - validator and history combined', async () => {
  const user = await Proto.run('createTestUser');
  
  // Set initial password that meets validator requirements
  await Proto.run('setPassword', { userId: user.id, password: 'ValidPass1' });
  
  // Try to set a password that's in history but doesn't meet validator (should fail for validator first)
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'invalid' }))
    .rejects.toThrow('Password does not meet the policy requirements');
  
  // Set a valid second password
  await Proto.run('setPassword', { userId: user.id, password: 'ValidPass2' });
  
  // Try to reuse first password (should fail for history check)
  await expect(() => Proto.run('setPassword', { userId: user.id, password: 'ValidPass1' }))
    .rejects.toThrow('Cannot reuse previous passwords');
  
  // Set a valid third password
  await Proto.run('setPassword', { userId: user.id, password: 'ValidPass3' });
  const isValid = await Proto.run('verifyPassword', { userId: user.id, password: 'ValidPass3' });
  expect(isValid).toBe(true);
});

test('test password policy - unset password clears verification', async () => {
  const user = await Proto.run('createTestUser');
  
  // Set password
  await Proto.run('setPassword', { userId: user.id, password: 'Password123' });
  
  // Verify it works
  let isValid = await Proto.run('verifyPassword', { userId: user.id, password: 'Password123' });
  expect(isValid).toBe(true);
  
  // Unset password
  await Proto.run('unsetPassword', { userId: user.id });
  
  // Verify old password no longer works
  isValid = await Proto.run('verifyPassword', { userId: user.id, password: 'Password123' });
  expect(isValid).toBe(false);
  
  // Set a new password (history should not prevent this since password was unset)
  await Proto.run('setPassword', { userId: user.id, password: 'NewPassword456' });
  isValid = await Proto.run('verifyPassword', { userId: user.id, password: 'NewPassword456' });
  expect(isValid).toBe(true);
});
