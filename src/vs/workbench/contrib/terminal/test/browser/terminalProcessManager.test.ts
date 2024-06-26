/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { strictEqual } from 'assert';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TerminalProcessManager } from 'vs/workbench/contrib/terminal/browser/terminalProcessManager';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { ITestInstantiationService, TestTerminalProfileResolverService, workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { IProductService } from 'vs/platform/product/common/productService';
import { IEnvironmentVariableService } from 'vs/workbench/contrib/terminal/common/environmentVariable';
import { EnvironmentVariableService } from 'vs/workbench/contrib/terminal/common/environmentVariableService';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { ITerminalChildProcess, ITerminalLogService } from 'vs/platform/terminal/common/terminal';
import { ITerminalProfileResolverService } from 'vs/workbench/contrib/terminal/common/terminal';
import { ITerminalConfigurationService, ITerminalInstanceService } from 'vs/workbench/contrib/terminal/browser/terminal';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { TestProductService } from 'vs/workbench/test/common/workbenchTestServices';
import { ensureNoDisposablesAreLeakedInTestSuite } from 'vs/base/test/common/utils';
import { NullLogService } from 'vs/platform/log/common/log';
import { TerminalConfigurationService } from 'vs/workbench/contrib/terminal/browser/terminalConfigurationService';

class TestTerminalChildProcess implements ITerminalChildProcess {
	id: number = 0;
	get capabilities() { return []; }
	constructor(
		readonly shouldPersist: boolean
	) {
	}
	updateProperty(property: any, value: any): Promise<void> {
		throw new Error('Method not implemented.');
	}

	onProcessOverrideDimensions?: Event<any> | undefined;
	onProcessResolvedShellLaunchConfig?: Event<any> | undefined;
	onDidChangeHasChildProcesses?: Event<any> | undefined;

	onDidChangeProperty = Event.None;
	onProcessData = Event.None;
	onProcessExit = Event.None;
	onProcessReady = Event.None;
	onProcessTitleChanged = Event.None;
	onProcessShellTypeChanged = Event.None;
	async start(): Promise<undefined> { return undefined; }
	shutdown(immediate: boolean): void { }
	input(data: string): void { }
	resize(cols: number, rows: number): void { }
	clearBuffer(): void { }
	acknowledgeDataEvent(charCount: number): void { }
	async setUnicodeVersion(version: '6' | '11'): Promise<void> { }
	async getInitialCwd(): Promise<string> { return ''; }
	async getCwd(): Promise<string> { return ''; }
	async processBinary(data: string): Promise<void> { }
	refreshProperty(property: any): Promise<any> { return Promise.resolve(''); }
}

class TestTerminalInstanceService implements Partial<ITerminalInstanceService> {
	getBackend() {
		return {
			onPtyHostExit: Event.None,
			onPtyHostUnresponsive: Event.None,
			onPtyHostResponsive: Event.None,
			onPtyHostRestart: Event.None,
			onDidMoveWindowInstance: Event.None,
			onDidRequestDetach: Event.None,
			createProcess: (
				shellLaunchConfig: any,
				cwd: string,
				cols: number,
				rows: number,
				unicodeVersion: '6' | '11',
				env: any,
				windowsEnableConpty: boolean,
				shouldPersist: boolean
			) => new TestTerminalChildProcess(shouldPersist),
			getLatency: () => Promise.resolve([])
		} as any;
	}
}

suite('Workbench - TerminalProcessManager', () => {
	let store: DisposableStore;
	let instantiationService: ITestInstantiationService;
	let manager: TerminalProcessManager;

	setup(async () => {
		store = new DisposableStore();
		instantiationService = workbenchInstantiationService(undefined, store);
		const configurationService = new TestConfigurationService();
		await configurationService.setUserConfiguration('editor', { fontFamily: 'foo' });
		await configurationService.setUserConfiguration('terminal', {
			integrated: {
				fontFamily: 'bar',
				enablePersistentSessions: true,
				shellIntegration: {
					enabled: false
				}
			}
		});
		instantiationService.stub(IConfigurationService, configurationService);
		instantiationService.stub(ITerminalConfigurationService, instantiationService.createInstance(TerminalConfigurationService));
		instantiationService.stub(IProductService, TestProductService);
		instantiationService.stub(ITerminalLogService, new NullLogService());
		instantiationService.stub(IEnvironmentVariableService, instantiationService.createInstance(EnvironmentVariableService));
		instantiationService.stub(ITerminalProfileResolverService, TestTerminalProfileResolverService);
		instantiationService.stub(ITerminalInstanceService, new TestTerminalInstanceService());

		manager = store.add(instantiationService.createInstance(TerminalProcessManager, 1, undefined, undefined, undefined));
	});

	teardown(() => store.dispose());

	ensureNoDisposablesAreLeakedInTestSuite();

	suite('process persistence', () => {
		suite('local', () => {
			test('regular terminal should persist', async () => {
				const p = await manager.createProcess({
				}, 1, 1, false);
				strictEqual(p, undefined);
				strictEqual(manager.shouldPersist, true);
			});
			test('task terminal should not persist', async () => {
				const p = await manager.createProcess({
					isFeatureTerminal: true
				}, 1, 1, false);
				strictEqual(p, undefined);
				strictEqual(manager.shouldPersist, false);
			});
		});
		suite('remote', () => {
			const remoteCwd = URI.from({
				scheme: Schemas.vscodeRemote,
				path: 'test/cwd'
			});

			test('regular terminal should persist', async () => {
				const p = await manager.createProcess({
					cwd: remoteCwd
				}, 1, 1, false);
				strictEqual(p, undefined);
				strictEqual(manager.shouldPersist, true);
			});
			test('task terminal should not persist', async () => {
				const p = await manager.createProcess({
					isFeatureTerminal: true,
					cwd: remoteCwd
				}, 1, 1, false);
				strictEqual(p, undefined);
				strictEqual(manager.shouldPersist, false);
			});
		});
	});
});
