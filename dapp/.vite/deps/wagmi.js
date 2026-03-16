import {
  BaseError,
  ChainNotConfiguredError,
  ConnectorAccountNotFoundError,
  ConnectorAlreadyConnectedError,
  ConnectorChainMismatchError,
  ConnectorNotConnectedError,
  ConnectorNotFoundError,
  ConnectorUnavailableReconnectingError,
  ProviderNotFoundError,
  SwitchChainNotSupportedError,
  call,
  connect,
  createClient,
  createTransport,
  custom,
  deepEqual,
  deployContract,
  disconnect,
  estimateFeesPerGas,
  estimateGas,
  estimateMaxPriorityFeePerGas,
  fallback,
  getAction,
  getBalance,
  getBlobBaseFee,
  getBlock,
  getBlockNumber,
  getBlockTransactionCount,
  getBytecode,
  getCallsStatus,
  getCapabilities,
  getChainId,
  getChains,
  getClient,
  getConnection,
  getConnections,
  getConnectorClient,
  getConnectors,
  getContractEvents,
  getEnsAddress,
  getEnsAvatar,
  getEnsName,
  getEnsResolver,
  getEnsText,
  getFeeHistory,
  getGasPrice,
  getProof,
  getPublicClient,
  getStorageAt,
  getTransaction,
  getTransactionConfirmations,
  getTransactionCount,
  getTransactionReceipt,
  getWalletClient,
  http,
  prepareTransactionRequest,
  readContract,
  readContracts,
  reconnect,
  rpc,
  sendCalls,
  sendCallsSync,
  sendTransaction,
  sendTransactionSync,
  showCallsStatus,
  signMessage,
  signTransaction,
  signTypedData,
  simulateContract,
  switchChain,
  switchConnection,
  verifyMessage,
  verifyTypedData,
  version,
  waitForCallsStatus,
  waitForTransactionReceipt,
  watchAsset,
  watchBlockNumber,
  watchBlocks,
  watchChainId,
  watchClient,
  watchConnection,
  watchConnections,
  watchConnectors,
  watchContractEvent,
  watchPendingTransactions,
  watchPublicClient,
  webSocket,
  withRetry,
  withTimeout,
  writeContract,
  writeContractSync
} from "./chunk-DEI6B6JM.js";
import "./chunk-A23XWNDJ.js";
import {
  replaceEqualDeep,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from "./chunk-H4YYNWDC.js";
import {
  require_react
} from "./chunk-VX2H6PUQ.js";
import {
  ChainDisconnectedError,
  ProviderDisconnectedError,
  ResourceUnavailableRpcError,
  RpcRequestError,
  SwitchChainError,
  UserRejectedRequestError,
  fromHex,
  getAddress,
  hexToNumber,
  keccak256,
  numberToHex,
  stringToHex
} from "./chunk-J7MOQB5A.js";
import "./chunk-LDHQ4BGN.js";
import {
  __commonJS,
  __toESM
} from "./chunk-G3PMV62Z.js";

// node_modules/eventemitter3/index.js
var require_eventemitter3 = __commonJS({
  "node_modules/eventemitter3/index.js"(exports, module) {
    "use strict";
    var has = Object.prototype.hasOwnProperty;
    var prefix = "~";
    function Events() {
    }
    if (Object.create) {
      Events.prototype = /* @__PURE__ */ Object.create(null);
      if (!new Events().__proto__) prefix = false;
    }
    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== "function") {
        throw new TypeError("The listener must be a function");
      }
      var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
      if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
      else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
      else emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0) emitter._events = new Events();
      else delete emitter._events[evt];
    }
    function EventEmitter2() {
      this._events = new Events();
      this._eventsCount = 0;
    }
    EventEmitter2.prototype.eventNames = function eventNames() {
      var names = [], events, name;
      if (this._eventsCount === 0) return names;
      for (name in events = this._events) {
        if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
      }
      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }
      return names;
    };
    EventEmitter2.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event, handlers = this._events[evt];
      if (!handlers) return [];
      if (handlers.fn) return [handlers.fn];
      for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
        ee[i] = handlers[i].fn;
      }
      return ee;
    };
    EventEmitter2.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event, listeners = this._events[evt];
      if (!listeners) return 0;
      if (listeners.fn) return 1;
      return listeners.length;
    };
    EventEmitter2.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return false;
      var listeners = this._events[evt], len = arguments.length, args, i;
      if (listeners.fn) {
        if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;
          case 2:
            return listeners.fn.call(listeners.context, a1), true;
          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;
          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;
          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
          case 6:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }
        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length, j;
        for (i = 0; i < length; i++) {
          if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;
            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;
            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;
            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;
            default:
              if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                args[j - 1] = arguments[j];
              }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }
      return true;
    };
    EventEmitter2.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    EventEmitter2.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    EventEmitter2.prototype.removeListener = function removeListener(event, fn, context, once) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return this;
      if (!fn) {
        clearEvent(this, evt);
        return this;
      }
      var listeners = this._events[evt];
      if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
          clearEvent(this, evt);
        }
      } else {
        for (var i = 0, events = [], length = listeners.length; i < length; i++) {
          if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
            events.push(listeners[i]);
          }
        }
        if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
        else clearEvent(this, evt);
      }
      return this;
    };
    EventEmitter2.prototype.removeAllListeners = function removeAllListeners(event) {
      var evt;
      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt]) clearEvent(this, evt);
      } else {
        this._events = new Events();
        this._eventsCount = 0;
      }
      return this;
    };
    EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
    EventEmitter2.prototype.addListener = EventEmitter2.prototype.on;
    EventEmitter2.prefixed = prefix;
    EventEmitter2.EventEmitter = EventEmitter2;
    if ("undefined" !== typeof module) {
      module.exports = EventEmitter2;
    }
  }
});

// node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.development.js
var require_use_sync_external_store_shim_development = __commonJS({
  "node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.development.js"(exports) {
    "use strict";
    (function() {
      function is(x, y) {
        return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
      }
      function useSyncExternalStore$2(subscribe, getSnapshot) {
        didWarnOld18Alpha || void 0 === React.startTransition || (didWarnOld18Alpha = true, console.error(
          "You are using an outdated, pre-release alpha of React 18 that does not support useSyncExternalStore. The use-sync-external-store shim will not work correctly. Upgrade to a newer pre-release."
        ));
        var value = getSnapshot();
        if (!didWarnUncachedGetSnapshot) {
          var cachedValue = getSnapshot();
          objectIs(value, cachedValue) || (console.error(
            "The result of getSnapshot should be cached to avoid an infinite loop"
          ), didWarnUncachedGetSnapshot = true);
        }
        cachedValue = useState({
          inst: { value, getSnapshot }
        });
        var inst = cachedValue[0].inst, forceUpdate = cachedValue[1];
        useLayoutEffect(
          function() {
            inst.value = value;
            inst.getSnapshot = getSnapshot;
            checkIfSnapshotChanged(inst) && forceUpdate({ inst });
          },
          [subscribe, value, getSnapshot]
        );
        useEffect10(
          function() {
            checkIfSnapshotChanged(inst) && forceUpdate({ inst });
            return subscribe(function() {
              checkIfSnapshotChanged(inst) && forceUpdate({ inst });
            });
          },
          [subscribe]
        );
        useDebugValue(value);
        return value;
      }
      function checkIfSnapshotChanged(inst) {
        var latestGetSnapshot = inst.getSnapshot;
        inst = inst.value;
        try {
          var nextValue = latestGetSnapshot();
          return !objectIs(inst, nextValue);
        } catch (error) {
          return true;
        }
      }
      function useSyncExternalStore$1(subscribe, getSnapshot) {
        return getSnapshot();
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var React = require_react(), objectIs = "function" === typeof Object.is ? Object.is : is, useState = React.useState, useEffect10 = React.useEffect, useLayoutEffect = React.useLayoutEffect, useDebugValue = React.useDebugValue, didWarnOld18Alpha = false, didWarnUncachedGetSnapshot = false, shim = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
      exports.useSyncExternalStore = void 0 !== React.useSyncExternalStore ? React.useSyncExternalStore : shim;
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// node_modules/use-sync-external-store/shim/index.js
var require_shim = __commonJS({
  "node_modules/use-sync-external-store/shim/index.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_use_sync_external_store_shim_development();
    }
  }
});

// node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.development.js
var require_with_selector_development = __commonJS({
  "node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.development.js"(exports) {
    "use strict";
    (function() {
      function is(x, y) {
        return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
      }
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
      var React = require_react(), shim = require_shim(), objectIs = "function" === typeof Object.is ? Object.is : is, useSyncExternalStore5 = shim.useSyncExternalStore, useRef9 = React.useRef, useEffect10 = React.useEffect, useMemo3 = React.useMemo, useDebugValue = React.useDebugValue;
      exports.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
        var instRef = useRef9(null);
        if (null === instRef.current) {
          var inst = { hasValue: false, value: null };
          instRef.current = inst;
        } else inst = instRef.current;
        instRef = useMemo3(
          function() {
            function memoizedSelector(nextSnapshot) {
              if (!hasMemo) {
                hasMemo = true;
                memoizedSnapshot = nextSnapshot;
                nextSnapshot = selector(nextSnapshot);
                if (void 0 !== isEqual && inst.hasValue) {
                  var currentSelection = inst.value;
                  if (isEqual(currentSelection, nextSnapshot))
                    return memoizedSelection = currentSelection;
                }
                return memoizedSelection = nextSnapshot;
              }
              currentSelection = memoizedSelection;
              if (objectIs(memoizedSnapshot, nextSnapshot))
                return currentSelection;
              var nextSelection = selector(nextSnapshot);
              if (void 0 !== isEqual && isEqual(currentSelection, nextSelection))
                return memoizedSnapshot = nextSnapshot, currentSelection;
              memoizedSnapshot = nextSnapshot;
              return memoizedSelection = nextSelection;
            }
            var hasMemo = false, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
            return [
              function() {
                return memoizedSelector(getSnapshot());
              },
              null === maybeGetServerSnapshot ? void 0 : function() {
                return memoizedSelector(maybeGetServerSnapshot());
              }
            ];
          },
          [getSnapshot, getServerSnapshot, selector, isEqual]
        );
        var value = useSyncExternalStore5(subscribe, instRef[0], instRef[1]);
        useEffect10(
          function() {
            inst.hasValue = true;
            inst.value = value;
          },
          [value]
        );
        useDebugValue(value);
        return value;
      };
      "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
    })();
  }
});

// node_modules/use-sync-external-store/shim/with-selector.js
var require_with_selector = __commonJS({
  "node_modules/use-sync-external-store/shim/with-selector.js"(exports, module) {
    "use strict";
    if (false) {
      module.exports = null;
    } else {
      module.exports = require_with_selector_development();
    }
  }
});

// node_modules/wagmi/dist/esm/context.js
var import_react2 = __toESM(require_react(), 1);

// node_modules/@wagmi/core/dist/esm/actions/sendCallsSync.js
async function sendCallsSync2(config, parameters) {
  const { account, chainId, connector, calls, ...rest } = parameters;
  const client = await getConnectorClient(config, {
    account,
    assertChainId: false,
    chainId,
    connector
  });
  const action = getAction(client, sendCallsSync, "sendCallsSync");
  return action({
    ...rest,
    ...typeof account !== "undefined" ? { account } : {},
    calls,
    chain: chainId ? { id: chainId } : void 0
  });
}

// node_modules/@wagmi/core/dist/esm/actions/sendTransactionSync.js
async function sendTransactionSync2(config, parameters) {
  const { account, chainId, connector, ...rest } = parameters;
  let client;
  if (typeof account === "object" && account?.type === "local")
    client = config.getClient({ chainId });
  else
    client = await getConnectorClient(config, {
      account: account ?? void 0,
      assertChainId: false,
      chainId,
      connector
    });
  const chain = (() => {
    if (!chainId || client.chain?.id === chainId)
      return client.chain;
    return { id: chainId };
  })();
  const action = getAction(client, sendTransactionSync, "sendTransactionSync");
  const hash = await action({
    ...rest,
    ...account ? { account } : {},
    assertChainId: !!chainId,
    chain,
    gas: rest.gas ?? void 0
  });
  return hash;
}

// node_modules/@wagmi/core/dist/esm/actions/writeContractSync.js
async function writeContractSync2(config, parameters) {
  const { account, chainId, connector, ...request } = parameters;
  let client;
  if (typeof account === "object" && account?.type === "local")
    client = config.getClient({ chainId });
  else
    client = await getConnectorClient(config, {
      account: account ?? void 0,
      assertChainId: false,
      chainId,
      connector
    });
  const chain = (() => {
    if (!chainId || client.chain?.id === chainId)
      return client.chain;
    return { id: chainId };
  })();
  const action = getAction(client, writeContractSync, "writeContractSync");
  const receipt = await action({
    ...request,
    ...account ? { account } : {},
    assertChainId: !!chainId,
    chain
  });
  return receipt;
}

// node_modules/@wagmi/core/dist/esm/connectors/createConnector.js
function createConnector(createConnectorFn) {
  return createConnectorFn;
}

// node_modules/@wagmi/core/dist/esm/connectors/injected.js
injected.type = "injected";
function injected(parameters = {}) {
  const { shimDisconnect = true, unstable_shimAsyncInject } = parameters;
  function getTarget() {
    const target = parameters.target;
    if (typeof target === "function") {
      const result = target();
      if (result)
        return result;
    }
    if (typeof target === "object")
      return target;
    if (typeof target === "string")
      return {
        ...targetMap[target] ?? {
          id: target,
          name: `${target[0].toUpperCase()}${target.slice(1)}`,
          provider: `is${target[0].toUpperCase()}${target.slice(1)}`
        }
      };
    return {
      id: "injected",
      name: "Injected",
      provider(window2) {
        return window2?.ethereum;
      }
    };
  }
  let accountsChanged;
  let chainChanged;
  let connect2;
  let disconnect2;
  return createConnector((config) => ({
    get icon() {
      return getTarget().icon;
    },
    get id() {
      return getTarget().id;
    },
    get name() {
      return getTarget().name;
    },
    type: injected.type,
    async setup() {
      const provider = await this.getProvider();
      if (provider?.on && parameters.target) {
        if (!connect2) {
          connect2 = this.onConnect.bind(this);
          provider.on("connect", connect2);
        }
        if (!accountsChanged) {
          accountsChanged = this.onAccountsChanged.bind(this);
          provider.on("accountsChanged", accountsChanged);
        }
      }
    },
    async connect({ chainId, isReconnecting, withCapabilities } = {}) {
      const provider = await this.getProvider();
      if (!provider)
        throw new ProviderNotFoundError();
      let accounts = [];
      if (isReconnecting)
        accounts = await this.getAccounts().catch(() => []);
      else if (shimDisconnect) {
        try {
          const permissions = await provider.request({
            method: "wallet_requestPermissions",
            params: [{ eth_accounts: {} }]
          });
          accounts = permissions[0]?.caveats?.[0]?.value?.map((x) => getAddress(x));
          if (accounts.length > 0) {
            const sortedAccounts = await this.getAccounts();
            accounts = sortedAccounts;
          }
        } catch (err) {
          const error = err;
          if (error.code === UserRejectedRequestError.code)
            throw new UserRejectedRequestError(error);
          if (error.code === ResourceUnavailableRpcError.code)
            throw error;
        }
      }
      try {
        if (!accounts?.length && !isReconnecting) {
          const requestedAccounts = await provider.request({
            method: "eth_requestAccounts"
          });
          accounts = requestedAccounts.map((x) => getAddress(x));
        }
        if (connect2) {
          provider.removeListener("connect", connect2);
          connect2 = void 0;
        }
        if (!accountsChanged) {
          accountsChanged = this.onAccountsChanged.bind(this);
          provider.on("accountsChanged", accountsChanged);
        }
        if (!chainChanged) {
          chainChanged = this.onChainChanged.bind(this);
          provider.on("chainChanged", chainChanged);
        }
        if (!disconnect2) {
          disconnect2 = this.onDisconnect.bind(this);
          provider.on("disconnect", disconnect2);
        }
        let currentChainId = await this.getChainId();
        if (chainId && currentChainId !== chainId) {
          const chain = await this.switchChain({ chainId }).catch((error) => {
            if (error.code === UserRejectedRequestError.code)
              throw error;
            return { id: currentChainId };
          });
          currentChainId = chain?.id ?? currentChainId;
        }
        if (shimDisconnect)
          await config.storage?.removeItem(`${this.id}.disconnected`);
        if (!parameters.target)
          await config.storage?.setItem("injected.connected", true);
        return {
          accounts: withCapabilities ? accounts.map((address) => ({ address, capabilities: {} })) : accounts,
          chainId: currentChainId
        };
      } catch (err) {
        const error = err;
        if (error.code === UserRejectedRequestError.code)
          throw new UserRejectedRequestError(error);
        if (error.code === ResourceUnavailableRpcError.code)
          throw new ResourceUnavailableRpcError(error);
        throw error;
      }
    },
    async disconnect() {
      const provider = await this.getProvider();
      if (!provider)
        throw new ProviderNotFoundError();
      if (chainChanged) {
        provider.removeListener("chainChanged", chainChanged);
        chainChanged = void 0;
      }
      if (disconnect2) {
        provider.removeListener("disconnect", disconnect2);
        disconnect2 = void 0;
      }
      if (!connect2) {
        connect2 = this.onConnect.bind(this);
        provider.on("connect", connect2);
      }
      try {
        await withTimeout(() => (
          // TODO: Remove explicit type for viem@3
          provider.request({
            // `'wallet_revokePermissions'` added in `viem@2.10.3`
            method: "wallet_revokePermissions",
            params: [{ eth_accounts: {} }]
          })
        ), { timeout: 100 });
      } catch {
      }
      if (shimDisconnect) {
        await config.storage?.setItem(`${this.id}.disconnected`, true);
      }
      if (!parameters.target)
        await config.storage?.removeItem("injected.connected");
    },
    async getAccounts() {
      const provider = await this.getProvider();
      if (!provider)
        throw new ProviderNotFoundError();
      const accounts = await provider.request({ method: "eth_accounts" });
      return accounts.map((x) => getAddress(x));
    },
    async getChainId() {
      const provider = await this.getProvider();
      if (!provider)
        throw new ProviderNotFoundError();
      const hexChainId = await provider.request({ method: "eth_chainId" });
      return Number(hexChainId);
    },
    async getProvider() {
      if (typeof window === "undefined")
        return void 0;
      let provider;
      const target = getTarget();
      if (typeof target.provider === "function")
        provider = target.provider(window);
      else if (typeof target.provider === "string")
        provider = findProvider(window, target.provider);
      else
        provider = target.provider;
      if (provider && !provider.removeListener) {
        if ("off" in provider && typeof provider.off === "function")
          provider.removeListener = provider.off;
        else
          provider.removeListener = () => {
          };
      }
      return provider;
    },
    async isAuthorized() {
      try {
        const isDisconnected = shimDisconnect && // If shim exists in storage, connector is disconnected
        await config.storage?.getItem(`${this.id}.disconnected`);
        if (isDisconnected)
          return false;
        if (!parameters.target) {
          const connected = await config.storage?.getItem("injected.connected");
          if (!connected)
            return false;
        }
        const provider = await this.getProvider();
        if (!provider) {
          if (unstable_shimAsyncInject !== void 0 && unstable_shimAsyncInject !== false) {
            const handleEthereum = async () => {
              if (typeof window !== "undefined")
                window.removeEventListener("ethereum#initialized", handleEthereum);
              const provider2 = await this.getProvider();
              return !!provider2;
            };
            const timeout = typeof unstable_shimAsyncInject === "number" ? unstable_shimAsyncInject : 1e3;
            const res = await Promise.race([
              ...typeof window !== "undefined" ? [
                new Promise((resolve) => window.addEventListener("ethereum#initialized", () => resolve(handleEthereum()), { once: true }))
              ] : [],
              new Promise((resolve) => setTimeout(() => resolve(handleEthereum()), timeout))
            ]);
            if (res)
              return true;
          }
          throw new ProviderNotFoundError();
        }
        const accounts = await withRetry(() => this.getAccounts());
        return !!accounts.length;
      } catch {
        return false;
      }
    },
    async switchChain({ addEthereumChainParameter, chainId }) {
      const provider = await this.getProvider();
      if (!provider)
        throw new ProviderNotFoundError();
      const chain = config.chains.find((x) => x.id === chainId);
      if (!chain)
        throw new SwitchChainError(new ChainNotConfiguredError());
      const promise = new Promise((resolve) => {
        const listener = ((data) => {
          if ("chainId" in data && data.chainId === chainId) {
            config.emitter.off("change", listener);
            resolve();
          }
        });
        config.emitter.on("change", listener);
      });
      try {
        await Promise.all([
          provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: numberToHex(chainId) }]
          }).then(async () => {
            const currentChainId = await this.getChainId();
            if (currentChainId === chainId)
              config.emitter.emit("change", { chainId });
          }),
          promise
        ]);
        return chain;
      } catch (err) {
        const error = err;
        if (error.code === 4902 || // Unwrapping for MetaMask Mobile
        // https://github.com/MetaMask/metamask-mobile/issues/2944#issuecomment-976988719
        error?.data?.originalError?.code === 4902) {
          try {
            const { default: blockExplorer, ...blockExplorers } = chain.blockExplorers ?? {};
            let blockExplorerUrls;
            if (addEthereumChainParameter?.blockExplorerUrls)
              blockExplorerUrls = addEthereumChainParameter.blockExplorerUrls;
            else if (blockExplorer)
              blockExplorerUrls = [
                blockExplorer.url,
                ...Object.values(blockExplorers).map((x) => x.url)
              ];
            let rpcUrls;
            if (addEthereumChainParameter?.rpcUrls?.length)
              rpcUrls = addEthereumChainParameter.rpcUrls;
            else
              rpcUrls = [chain.rpcUrls.default?.http[0] ?? ""];
            const addEthereumChain = {
              blockExplorerUrls,
              chainId: numberToHex(chainId),
              chainName: addEthereumChainParameter?.chainName ?? chain.name,
              iconUrls: addEthereumChainParameter?.iconUrls,
              nativeCurrency: addEthereumChainParameter?.nativeCurrency ?? chain.nativeCurrency,
              rpcUrls
            };
            await Promise.all([
              provider.request({
                method: "wallet_addEthereumChain",
                params: [addEthereumChain]
              }).then(async () => {
                const currentChainId = await this.getChainId();
                if (currentChainId === chainId)
                  config.emitter.emit("change", { chainId });
                else
                  throw new UserRejectedRequestError(new Error("User rejected switch after adding network."));
              }),
              promise
            ]);
            return chain;
          } catch (error2) {
            throw new UserRejectedRequestError(error2);
          }
        }
        if (error.code === UserRejectedRequestError.code)
          throw new UserRejectedRequestError(error);
        throw new SwitchChainError(error);
      }
    },
    async onAccountsChanged(accounts) {
      if (accounts.length === 0)
        this.onDisconnect();
      else if (config.emitter.listenerCount("connect")) {
        const chainId = (await this.getChainId()).toString();
        this.onConnect({ chainId });
        if (shimDisconnect)
          await config.storage?.removeItem(`${this.id}.disconnected`);
      } else
        config.emitter.emit("change", {
          accounts: accounts.map((x) => getAddress(x))
        });
    },
    onChainChanged(chain) {
      const chainId = Number(chain);
      config.emitter.emit("change", { chainId });
    },
    async onConnect(connectInfo) {
      const accounts = await this.getAccounts();
      if (accounts.length === 0)
        return;
      const chainId = Number(connectInfo.chainId);
      config.emitter.emit("connect", { accounts, chainId });
      const provider = await this.getProvider();
      if (provider) {
        if (connect2) {
          provider.removeListener("connect", connect2);
          connect2 = void 0;
        }
        if (!accountsChanged) {
          accountsChanged = this.onAccountsChanged.bind(this);
          provider.on("accountsChanged", accountsChanged);
        }
        if (!chainChanged) {
          chainChanged = this.onChainChanged.bind(this);
          provider.on("chainChanged", chainChanged);
        }
        if (!disconnect2) {
          disconnect2 = this.onDisconnect.bind(this);
          provider.on("disconnect", disconnect2);
        }
      }
    },
    async onDisconnect(error) {
      const provider = await this.getProvider();
      if (error && error.code === 1013) {
        if (provider && !!(await this.getAccounts()).length)
          return;
      }
      config.emitter.emit("disconnect");
      if (provider) {
        if (chainChanged) {
          provider.removeListener("chainChanged", chainChanged);
          chainChanged = void 0;
        }
        if (disconnect2) {
          provider.removeListener("disconnect", disconnect2);
          disconnect2 = void 0;
        }
        if (!connect2) {
          connect2 = this.onConnect.bind(this);
          provider.on("connect", connect2);
        }
      }
    }
  }));
}
var targetMap = {
  coinbaseWallet: {
    id: "coinbaseWallet",
    name: "Coinbase Wallet",
    provider(window2) {
      if (window2?.coinbaseWalletExtension)
        return window2.coinbaseWalletExtension;
      return findProvider(window2, "isCoinbaseWallet");
    }
  },
  metaMask: {
    id: "metaMask",
    name: "MetaMask",
    provider(window2) {
      return findProvider(window2, (provider) => {
        if (!provider.isMetaMask)
          return false;
        if (provider.isBraveWallet && !provider._events && !provider._state)
          return false;
        const flags = [
          "isApexWallet",
          "isAvalanche",
          "isBitKeep",
          "isBlockWallet",
          "isKuCoinWallet",
          "isMathWallet",
          "isOkxWallet",
          "isOKExWallet",
          "isOneInchIOSWallet",
          "isOneInchAndroidWallet",
          "isOpera",
          "isPhantom",
          "isPortal",
          "isRabby",
          "isTokenPocket",
          "isTokenary",
          "isUniswapWallet",
          "isZerion"
        ];
        for (const flag of flags)
          if (provider[flag])
            return false;
        return true;
      });
    }
  },
  phantom: {
    id: "phantom",
    name: "Phantom",
    provider(window2) {
      if (window2?.phantom?.ethereum)
        return window2.phantom?.ethereum;
      return findProvider(window2, "isPhantom");
    }
  }
};
function findProvider(window2, select) {
  function isProvider(provider) {
    if (typeof select === "function")
      return select(provider);
    if (typeof select === "string")
      return provider[select];
    return true;
  }
  const ethereum = window2.ethereum;
  if (ethereum?.providers)
    return ethereum.providers.find((provider) => isProvider(provider));
  if (ethereum && isProvider(ethereum))
    return ethereum;
  return void 0;
}

// node_modules/@wagmi/core/dist/esm/connectors/mock.js
mock.type = "mock";
function mock(parameters) {
  const transactionCache = /* @__PURE__ */ new Map();
  const features = parameters.features ?? { defaultConnected: false };
  let connected = features.defaultConnected;
  let connectedChainId;
  return createConnector((config) => ({
    id: "mock",
    name: "Mock Connector",
    type: mock.type,
    async setup() {
      connectedChainId = config.chains[0].id;
    },
    async connect({ chainId, withCapabilities } = {}) {
      if (features.connectError) {
        if (typeof features.connectError === "boolean")
          throw new UserRejectedRequestError(new Error("Failed to connect."));
        throw features.connectError;
      }
      const provider = await this.getProvider();
      const accounts = await provider.request({
        method: "eth_requestAccounts"
      });
      let currentChainId = await this.getChainId();
      if (chainId && currentChainId !== chainId) {
        const chain = await this.switchChain({ chainId });
        currentChainId = chain.id;
      }
      connected = true;
      return {
        accounts: withCapabilities ? accounts.map((x) => ({
          address: getAddress(x),
          capabilities: { foo: { bar: x } }
        })) : accounts.map((x) => getAddress(x)),
        chainId: currentChainId
      };
    },
    async disconnect() {
      connected = false;
    },
    async getAccounts() {
      if (!connected)
        throw new ConnectorNotConnectedError();
      const provider = await this.getProvider();
      const accounts = await provider.request({ method: "eth_accounts" });
      return accounts.map((x) => getAddress(x));
    },
    async getChainId() {
      const provider = await this.getProvider();
      const hexChainId = await provider.request({ method: "eth_chainId" });
      return fromHex(hexChainId, "number");
    },
    async isAuthorized() {
      if (!features.reconnect)
        return false;
      if (!connected)
        return false;
      const accounts = await this.getAccounts();
      return !!accounts.length;
    },
    async switchChain({ chainId }) {
      const provider = await this.getProvider();
      const chain = config.chains.find((x) => x.id === chainId);
      if (!chain)
        throw new SwitchChainError(new ChainNotConfiguredError());
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: numberToHex(chainId) }]
      });
      return chain;
    },
    onAccountsChanged(accounts) {
      if (accounts.length === 0)
        this.onDisconnect();
      else
        config.emitter.emit("change", {
          accounts: accounts.map((x) => getAddress(x))
        });
    },
    onChainChanged(chain) {
      const chainId = Number(chain);
      config.emitter.emit("change", { chainId });
    },
    async onDisconnect(_error) {
      config.emitter.emit("disconnect");
      connected = false;
    },
    async getProvider({ chainId } = {}) {
      const chain = config.chains.find((x) => x.id === chainId) ?? config.chains[0];
      const url = chain.rpcUrls.default.http[0];
      const request = async ({ method, params }) => {
        if (method === "eth_chainId")
          return numberToHex(connectedChainId);
        if (method === "eth_accounts")
          return parameters.accounts;
        if (method === "eth_requestAccounts")
          return parameters.accounts;
        if (method === "eth_signTypedData_v4") {
          if (features.signTypedDataError) {
            if (typeof features.signTypedDataError === "boolean")
              throw new UserRejectedRequestError(new Error("Failed to sign typed data."));
            throw features.signTypedDataError;
          }
        }
        if (method === "wallet_switchEthereumChain") {
          if (features.switchChainError) {
            if (typeof features.switchChainError === "boolean")
              throw new UserRejectedRequestError(new Error("Failed to switch chain."));
            throw features.switchChainError;
          }
          connectedChainId = fromHex(params[0].chainId, "number");
          this.onChainChanged(connectedChainId.toString());
          return;
        }
        if (method === "wallet_watchAsset") {
          if (features.watchAssetError) {
            if (typeof features.watchAssetError === "boolean")
              throw new UserRejectedRequestError(new Error("Failed to switch chain."));
            throw features.watchAssetError;
          }
          return connected;
        }
        if (method === "wallet_getCapabilities")
          return {
            "0x2105": {
              paymasterService: {
                supported: params[0] === "0x95132632579b073D12a6673e18Ab05777a6B86f8"
              },
              sessionKeys: {
                supported: true
              }
            },
            "0x14A34": {
              paymasterService: {
                supported: params[0] === "0x95132632579b073D12a6673e18Ab05777a6B86f8"
              }
            }
          };
        if (method === "wallet_sendCalls") {
          const hashes = [];
          const calls = params[0].calls;
          const from = params[0].from;
          for (const call2 of calls) {
            const { result: result2, error: error2 } = await rpc.http(url, {
              body: {
                method: "eth_sendTransaction",
                params: [
                  {
                    ...call2,
                    ...typeof from !== "undefined" ? { from } : {}
                  }
                ]
              }
            });
            if (error2)
              throw new RpcRequestError({
                body: { method, params },
                error: error2,
                url
              });
            hashes.push(result2);
          }
          const id = keccak256(stringToHex(JSON.stringify(calls)));
          transactionCache.set(id, hashes);
          return { id };
        }
        if (method === "wallet_getCallsStatus") {
          const hashes = transactionCache.get(params[0]);
          if (!hashes)
            return {
              atomic: false,
              chainId: "0x1",
              id: params[0],
              status: 100,
              receipts: [],
              version: "2.0.0"
            };
          const receipts = await Promise.all(hashes.map(async (hash) => {
            const { result: result2, error: error2 } = await rpc.http(url, {
              body: {
                method: "eth_getTransactionReceipt",
                params: [hash],
                id: 0
              }
            });
            if (error2)
              throw new RpcRequestError({
                body: { method, params },
                error: error2,
                url
              });
            if (!result2)
              return null;
            return {
              blockHash: result2.blockHash,
              blockNumber: result2.blockNumber,
              gasUsed: result2.gasUsed,
              logs: result2.logs,
              status: result2.status,
              transactionHash: result2.transactionHash
            };
          }));
          const receipts_ = receipts.filter((x) => x !== null);
          if (receipts_.length === 0)
            return {
              atomic: false,
              chainId: "0x1",
              id: params[0],
              status: 100,
              receipts: [],
              version: "2.0.0"
            };
          return {
            atomic: false,
            chainId: "0x1",
            id: params[0],
            status: 200,
            receipts: receipts_,
            version: "2.0.0"
          };
        }
        if (method === "wallet_showCallsStatus")
          return;
        if (method === "personal_sign") {
          if (features.signMessageError) {
            if (typeof features.signMessageError === "boolean")
              throw new UserRejectedRequestError(new Error("Failed to sign message."));
            throw features.signMessageError;
          }
          method = "eth_sign";
          params = [params[1], params[0]];
        }
        const body = { method, params };
        const { error, result } = await rpc.http(url, { body });
        if (error)
          throw new RpcRequestError({ body, error, url });
        return result;
      };
      return custom({ request })({ retryCount: 0 });
    }
  }));
}

// node_modules/mipd/dist/esm/utils.js
function requestProviders(listener) {
  if (typeof window === "undefined")
    return;
  const handler = (event) => listener(event.detail);
  window.addEventListener("eip6963:announceProvider", handler);
  window.dispatchEvent(new CustomEvent("eip6963:requestProvider"));
  return () => window.removeEventListener("eip6963:announceProvider", handler);
}

// node_modules/mipd/dist/esm/store.js
function createStore() {
  const listeners = /* @__PURE__ */ new Set();
  let providerDetails = [];
  const request = () => requestProviders((providerDetail) => {
    if (providerDetails.some(({ info }) => info.uuid === providerDetail.info.uuid))
      return;
    providerDetails = [...providerDetails, providerDetail];
    listeners.forEach((listener) => listener(providerDetails, { added: [providerDetail] }));
  });
  let unwatch = request();
  return {
    _listeners() {
      return listeners;
    },
    clear() {
      listeners.forEach((listener) => listener([], { removed: [...providerDetails] }));
      providerDetails = [];
    },
    destroy() {
      this.clear();
      listeners.clear();
      unwatch?.();
    },
    findProvider({ rdns }) {
      return providerDetails.find((providerDetail) => providerDetail.info.rdns === rdns);
    },
    getProviders() {
      return providerDetails;
    },
    reset() {
      this.clear();
      unwatch?.();
      unwatch = request();
    },
    subscribe(listener, { emitImmediately } = {}) {
      listeners.add(listener);
      if (emitImmediately)
        listener(providerDetails, { added: providerDetails });
      return () => listeners.delete(listener);
    }
  };
}

// node_modules/zustand/esm/middleware.mjs
var subscribeWithSelectorImpl = (fn) => (set, get, api) => {
  const origSubscribe = api.subscribe;
  api.subscribe = (selector, optListener, options) => {
    let listener = selector;
    if (optListener) {
      const equalityFn = (options == null ? void 0 : options.equalityFn) || Object.is;
      let currentSlice = selector(api.getState());
      listener = (state) => {
        const nextSlice = selector(state);
        if (!equalityFn(currentSlice, nextSlice)) {
          const previousSlice = currentSlice;
          optListener(currentSlice = nextSlice, previousSlice);
        }
      };
      if (options == null ? void 0 : options.fireImmediately) {
        optListener(currentSlice, currentSlice);
      }
    }
    return origSubscribe(listener);
  };
  const initialState = fn(set, get, api);
  return initialState;
};
var subscribeWithSelector = subscribeWithSelectorImpl;
function createJSONStorage(getStorage, options) {
  let storage;
  try {
    storage = getStorage();
  } catch (e) {
    return;
  }
  const persistStorage = {
    getItem: (name) => {
      var _a;
      const parse = (str2) => {
        if (str2 === null) {
          return null;
        }
        return JSON.parse(str2, options == null ? void 0 : options.reviver);
      };
      const str = (_a = storage.getItem(name)) != null ? _a : null;
      if (str instanceof Promise) {
        return str.then(parse);
      }
      return parse(str);
    },
    setItem: (name, newValue) => storage.setItem(
      name,
      JSON.stringify(newValue, options == null ? void 0 : options.replacer)
    ),
    removeItem: (name) => storage.removeItem(name)
  };
  return persistStorage;
}
var toThenable = (fn) => (input) => {
  try {
    const result = fn(input);
    if (result instanceof Promise) {
      return result;
    }
    return {
      then(onFulfilled) {
        return toThenable(onFulfilled)(result);
      },
      catch(_onRejected) {
        return this;
      }
    };
  } catch (e) {
    return {
      then(_onFulfilled) {
        return this;
      },
      catch(onRejected) {
        return toThenable(onRejected)(e);
      }
    };
  }
};
var persistImpl = (config, baseOptions) => (set, get, api) => {
  let options = {
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => state,
    version: 0,
    merge: (persistedState, currentState) => ({
      ...currentState,
      ...persistedState
    }),
    ...baseOptions
  };
  let hasHydrated = false;
  const hydrationListeners = /* @__PURE__ */ new Set();
  const finishHydrationListeners = /* @__PURE__ */ new Set();
  let storage = options.storage;
  if (!storage) {
    return config(
      (...args) => {
        console.warn(
          `[zustand persist middleware] Unable to update item '${options.name}', the given storage is currently unavailable.`
        );
        set(...args);
      },
      get,
      api
    );
  }
  const setItem = () => {
    const state = options.partialize({ ...get() });
    return storage.setItem(options.name, {
      state,
      version: options.version
    });
  };
  const savedSetState = api.setState;
  api.setState = (state, replace) => {
    savedSetState(state, replace);
    void setItem();
  };
  const configResult = config(
    (...args) => {
      set(...args);
      void setItem();
    },
    get,
    api
  );
  api.getInitialState = () => configResult;
  let stateFromStorage;
  const hydrate2 = () => {
    var _a, _b;
    if (!storage) return;
    hasHydrated = false;
    hydrationListeners.forEach((cb) => {
      var _a2;
      return cb((_a2 = get()) != null ? _a2 : configResult);
    });
    const postRehydrationCallback = ((_b = options.onRehydrateStorage) == null ? void 0 : _b.call(options, (_a = get()) != null ? _a : configResult)) || void 0;
    return toThenable(storage.getItem.bind(storage))(options.name).then((deserializedStorageValue) => {
      if (deserializedStorageValue) {
        if (typeof deserializedStorageValue.version === "number" && deserializedStorageValue.version !== options.version) {
          if (options.migrate) {
            return [
              true,
              options.migrate(
                deserializedStorageValue.state,
                deserializedStorageValue.version
              )
            ];
          }
          console.error(
            `State loaded from storage couldn't be migrated since no migrate function was provided`
          );
        } else {
          return [false, deserializedStorageValue.state];
        }
      }
      return [false, void 0];
    }).then((migrationResult) => {
      var _a2;
      const [migrated, migratedState] = migrationResult;
      stateFromStorage = options.merge(
        migratedState,
        (_a2 = get()) != null ? _a2 : configResult
      );
      set(stateFromStorage, true);
      if (migrated) {
        return setItem();
      }
    }).then(() => {
      postRehydrationCallback == null ? void 0 : postRehydrationCallback(stateFromStorage, void 0);
      stateFromStorage = get();
      hasHydrated = true;
      finishHydrationListeners.forEach((cb) => cb(stateFromStorage));
    }).catch((e) => {
      postRehydrationCallback == null ? void 0 : postRehydrationCallback(void 0, e);
    });
  };
  api.persist = {
    setOptions: (newOptions) => {
      options = {
        ...options,
        ...newOptions
      };
      if (newOptions.storage) {
        storage = newOptions.storage;
      }
    },
    clearStorage: () => {
      storage == null ? void 0 : storage.removeItem(options.name);
    },
    getOptions: () => options,
    rehydrate: () => hydrate2(),
    hasHydrated: () => hasHydrated,
    onHydrate: (cb) => {
      hydrationListeners.add(cb);
      return () => {
        hydrationListeners.delete(cb);
      };
    },
    onFinishHydration: (cb) => {
      finishHydrationListeners.add(cb);
      return () => {
        finishHydrationListeners.delete(cb);
      };
    }
  };
  if (!options.skipHydration) {
    hydrate2();
  }
  return stateFromStorage || configResult;
};
var persist = persistImpl;

// node_modules/zustand/esm/vanilla.mjs
var createStoreImpl = (createState) => {
  let state;
  const listeners = /* @__PURE__ */ new Set();
  const setState = (partial, replace) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const getInitialState = () => initialState;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const api = { setState, getState, getInitialState, subscribe };
  const initialState = state = createState(setState, getState, api);
  return api;
};
var createStore2 = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;

// node_modules/eventemitter3/index.mjs
var import_index = __toESM(require_eventemitter3(), 1);

// node_modules/@wagmi/core/dist/esm/createEmitter.js
var Emitter = class {
  constructor(uid2) {
    Object.defineProperty(this, "uid", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: uid2
    });
    Object.defineProperty(this, "_emitter", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: new import_index.default()
    });
  }
  on(eventName, fn) {
    this._emitter.on(eventName, fn);
  }
  once(eventName, fn) {
    this._emitter.once(eventName, fn);
  }
  off(eventName, fn) {
    this._emitter.off(eventName, fn);
  }
  emit(eventName, ...params) {
    const data = params[0];
    this._emitter.emit(eventName, { uid: this.uid, ...data });
  }
  listenerCount(eventName) {
    return this._emitter.listenerCount(eventName);
  }
};
function createEmitter(uid2) {
  return new Emitter(uid2);
}

// node_modules/@wagmi/core/dist/esm/utils/deserialize.js
function deserialize(value, reviver) {
  return JSON.parse(value, (key, value_) => {
    let value2 = value_;
    if (value2?.__type === "bigint")
      value2 = BigInt(value2.value);
    if (value2?.__type === "Map")
      value2 = new Map(value2.value);
    return reviver?.(key, value2) ?? value2;
  });
}

// node_modules/@wagmi/core/dist/esm/utils/serialize.js
function getReferenceKey(keys, cutoff) {
  return keys.slice(0, cutoff).join(".") || ".";
}
function getCutoff(array, value) {
  const { length } = array;
  for (let index2 = 0; index2 < length; ++index2) {
    if (array[index2] === value) {
      return index2 + 1;
    }
  }
  return 0;
}
function createReplacer(replacer, circularReplacer) {
  const hasReplacer = typeof replacer === "function";
  const hasCircularReplacer = typeof circularReplacer === "function";
  const cache = [];
  const keys = [];
  return function replace(key, value) {
    if (typeof value === "object") {
      if (cache.length) {
        const thisCutoff = getCutoff(cache, this);
        if (thisCutoff === 0) {
          cache[cache.length] = this;
        } else {
          cache.splice(thisCutoff);
          keys.splice(thisCutoff);
        }
        keys[keys.length] = key;
        const valueCutoff = getCutoff(cache, value);
        if (valueCutoff !== 0) {
          return hasCircularReplacer ? circularReplacer.call(this, key, value, getReferenceKey(keys, valueCutoff)) : `[ref=${getReferenceKey(keys, valueCutoff)}]`;
        }
      } else {
        cache[0] = value;
        keys[0] = key;
      }
    }
    return hasReplacer ? replacer.call(this, key, value) : value;
  };
}
function serialize(value, replacer, indent, circularReplacer) {
  return JSON.stringify(value, createReplacer((key, value_) => {
    let value2 = value_;
    if (typeof value2 === "bigint")
      value2 = { __type: "bigint", value: value_.toString() };
    if (value2 instanceof Map)
      value2 = { __type: "Map", value: Array.from(value_.entries()) };
    return replacer?.(key, value2) ?? value2;
  }, circularReplacer), indent ?? void 0);
}

// node_modules/@wagmi/core/dist/esm/createStorage.js
function createStorage(parameters) {
  const { deserialize: deserialize2 = deserialize, key: prefix = "wagmi", serialize: serialize2 = serialize, storage = noopStorage } = parameters;
  function unwrap(value) {
    if (value instanceof Promise)
      return value.then((x) => x).catch(() => null);
    return value;
  }
  return {
    ...storage,
    key: prefix,
    async getItem(key, defaultValue) {
      const value = storage.getItem(`${prefix}.${key}`);
      const unwrapped = await unwrap(value);
      if (unwrapped)
        return deserialize2(unwrapped) ?? null;
      return defaultValue ?? null;
    },
    async setItem(key, value) {
      const storageKey = `${prefix}.${key}`;
      if (value === null)
        await unwrap(storage.removeItem(storageKey));
      else
        await unwrap(storage.setItem(storageKey, serialize2(value)));
    },
    async removeItem(key) {
      await unwrap(storage.removeItem(`${prefix}.${key}`));
    }
  };
}
var noopStorage = {
  getItem: () => null,
  setItem: () => {
  },
  removeItem: () => {
  }
};
function getDefaultStorage() {
  const storage = (() => {
    if (typeof window !== "undefined" && window.localStorage)
      return window.localStorage;
    return noopStorage;
  })();
  return {
    getItem(key) {
      return storage.getItem(key);
    },
    removeItem(key) {
      storage.removeItem(key);
    },
    setItem(key, value) {
      try {
        storage.setItem(key, value);
      } catch {
      }
    }
  };
}

// node_modules/@wagmi/core/dist/esm/utils/uid.js
var size = 256;
var index = size;
var buffer;
function uid(length = 11) {
  if (!buffer || index + length > size * 2) {
    buffer = "";
    index = 0;
    for (let i = 0; i < size; i++) {
      buffer += (256 + Math.random() * 256 | 0).toString(16).substring(1);
    }
  }
  return buffer.substring(index, index++ + length);
}

// node_modules/@wagmi/core/dist/esm/createConfig.js
function createConfig(parameters) {
  const { multiInjectedProviderDiscovery = true, storage = createStorage({
    storage: getDefaultStorage()
  }), syncConnectedChain = true, ssr = false, ...rest } = parameters;
  const mipd = typeof window !== "undefined" && multiInjectedProviderDiscovery ? createStore() : void 0;
  const chains = createStore2(() => rest.chains);
  const connectors = createStore2(() => {
    const collection = [];
    const rdnsSet = /* @__PURE__ */ new Set();
    for (const connectorFns of rest.connectors ?? []) {
      const connector = setup(connectorFns);
      collection.push(connector);
      if (!ssr && connector.rdns) {
        const rdnsValues = typeof connector.rdns === "string" ? [connector.rdns] : connector.rdns;
        for (const rdns of rdnsValues) {
          rdnsSet.add(rdns);
        }
      }
    }
    if (!ssr && mipd) {
      const providers = mipd.getProviders();
      for (const provider of providers) {
        if (rdnsSet.has(provider.info.rdns))
          continue;
        collection.push(setup(providerDetailToConnector(provider)));
      }
    }
    return collection;
  });
  function setup(connectorFn) {
    const emitter = createEmitter(uid());
    const connector = {
      ...connectorFn({
        emitter,
        chains: chains.getState(),
        storage,
        transports: rest.transports
      }),
      emitter,
      uid: emitter.uid
    };
    emitter.on("connect", connect2);
    connector.setup?.();
    return connector;
  }
  function providerDetailToConnector(providerDetail) {
    const { info } = providerDetail;
    const provider = providerDetail.provider;
    return injected({ target: { ...info, id: info.rdns, provider } });
  }
  const clients = /* @__PURE__ */ new Map();
  function getClient2(config = {}) {
    const chainId = config.chainId ?? store.getState().chainId;
    const chain = chains.getState().find((x) => x.id === chainId);
    if (config.chainId && !chain)
      throw new ChainNotConfiguredError();
    {
      const client2 = clients.get(store.getState().chainId);
      if (client2 && !chain)
        return client2;
      if (!chain)
        throw new ChainNotConfiguredError();
    }
    {
      const client2 = clients.get(chainId);
      if (client2)
        return client2;
    }
    let client;
    if (rest.client)
      client = rest.client({ chain });
    else {
      const chainId2 = chain.id;
      const chainIds = chains.getState().map((x) => x.id);
      const properties = {};
      const entries = Object.entries(rest);
      for (const [key, value] of entries) {
        if (key === "chains" || key === "client" || key === "connectors" || key === "transports")
          continue;
        if (typeof value === "object") {
          if (chainId2 in value)
            properties[key] = value[chainId2];
          else {
            const hasChainSpecificValue = chainIds.some((x) => x in value);
            if (hasChainSpecificValue)
              continue;
            properties[key] = value;
          }
        } else
          properties[key] = value;
      }
      client = createClient({
        ...properties,
        chain,
        batch: properties.batch ?? { multicall: true },
        transport: (parameters2) => rest.transports[chainId2]({ ...parameters2, connectors })
      });
    }
    clients.set(chainId, client);
    return client;
  }
  function getInitialState() {
    return {
      chainId: chains.getState()[0].id,
      connections: /* @__PURE__ */ new Map(),
      current: null,
      status: "disconnected"
    };
  }
  let currentVersion;
  const prefix = "0.0.0-canary-";
  if (version.startsWith(prefix))
    currentVersion = Number.parseInt(version.replace(prefix, ""), 10);
  else
    currentVersion = Number.parseInt(version.split(".")[0] ?? "0", 10);
  const store = createStore2(subscribeWithSelector(
    // only use persist middleware if storage exists
    storage ? persist(getInitialState, {
      migrate(persistedState, version3) {
        if (version3 === currentVersion)
          return persistedState;
        const initialState = getInitialState();
        const chainId = validatePersistedChainId(persistedState, initialState.chainId);
        return { ...initialState, chainId };
      },
      name: "store",
      partialize(state) {
        return {
          connections: {
            __type: "Map",
            value: Array.from(state.connections.entries()).map(([key, connection]) => {
              const { id, name, type, uid: uid2 } = connection.connector;
              const connector = { id, name, type, uid: uid2 };
              return [key, { ...connection, connector }];
            })
          },
          chainId: state.chainId,
          current: state.current
        };
      },
      merge(persistedState, currentState) {
        if (typeof persistedState === "object" && persistedState && "status" in persistedState)
          delete persistedState.status;
        const chainId = validatePersistedChainId(persistedState, currentState.chainId);
        return {
          ...currentState,
          ...persistedState,
          chainId
        };
      },
      skipHydration: ssr,
      storage,
      version: currentVersion
    }) : getInitialState
  ));
  store.setState(getInitialState());
  function validatePersistedChainId(persistedState, defaultChainId) {
    return persistedState && typeof persistedState === "object" && "chainId" in persistedState && typeof persistedState.chainId === "number" && chains.getState().some((x) => x.id === persistedState.chainId) ? persistedState.chainId : defaultChainId;
  }
  if (syncConnectedChain)
    store.subscribe(({ connections, current }) => current ? connections.get(current)?.chainId : void 0, (chainId) => {
      const isChainConfigured = chains.getState().some((x) => x.id === chainId);
      if (!isChainConfigured)
        return;
      return store.setState((x) => ({
        ...x,
        chainId: chainId ?? x.chainId
      }));
    });
  mipd?.subscribe((providerDetails) => {
    const connectorIdSet = /* @__PURE__ */ new Set();
    const connectorRdnsSet = /* @__PURE__ */ new Set();
    for (const connector of connectors.getState()) {
      connectorIdSet.add(connector.id);
      if (connector.rdns) {
        const rdnsValues = typeof connector.rdns === "string" ? [connector.rdns] : connector.rdns;
        for (const rdns of rdnsValues) {
          connectorRdnsSet.add(rdns);
        }
      }
    }
    const newConnectors = [];
    for (const providerDetail of providerDetails) {
      if (connectorRdnsSet.has(providerDetail.info.rdns))
        continue;
      const connector = setup(providerDetailToConnector(providerDetail));
      if (connectorIdSet.has(connector.id))
        continue;
      newConnectors.push(connector);
    }
    if (storage && !store.persist.hasHydrated())
      return;
    connectors.setState((x) => [...x, ...newConnectors], true);
  });
  function change(data) {
    store.setState((x) => {
      const connection = x.connections.get(data.uid);
      if (!connection)
        return x;
      return {
        ...x,
        connections: new Map(x.connections).set(data.uid, {
          accounts: data.accounts ?? connection.accounts,
          chainId: data.chainId ?? connection.chainId,
          connector: connection.connector
        })
      };
    });
  }
  function connect2(data) {
    if (store.getState().status === "connecting" || store.getState().status === "reconnecting")
      return;
    store.setState((x) => {
      const connector = connectors.getState().find((x2) => x2.uid === data.uid);
      if (!connector)
        return x;
      if (connector.emitter.listenerCount("connect"))
        connector.emitter.off("connect", change);
      if (!connector.emitter.listenerCount("change"))
        connector.emitter.on("change", change);
      if (!connector.emitter.listenerCount("disconnect"))
        connector.emitter.on("disconnect", disconnect2);
      return {
        ...x,
        connections: new Map(x.connections).set(data.uid, {
          accounts: data.accounts,
          chainId: data.chainId,
          connector
        }),
        current: data.uid,
        status: "connected"
      };
    });
  }
  function disconnect2(data) {
    store.setState((x) => {
      const connection = x.connections.get(data.uid);
      if (connection) {
        const connector = connection.connector;
        if (connector.emitter.listenerCount("change"))
          connection.connector.emitter.off("change", change);
        if (connector.emitter.listenerCount("disconnect"))
          connection.connector.emitter.off("disconnect", disconnect2);
        if (!connector.emitter.listenerCount("connect"))
          connection.connector.emitter.on("connect", connect2);
      }
      x.connections.delete(data.uid);
      if (x.connections.size === 0)
        return {
          ...x,
          connections: /* @__PURE__ */ new Map(),
          current: null,
          status: "disconnected"
        };
      const nextConnection = x.connections.values().next().value;
      return {
        ...x,
        connections: new Map(x.connections),
        current: nextConnection.connector.uid
      };
    });
  }
  return {
    get chains() {
      return chains.getState();
    },
    get connectors() {
      return connectors.getState();
    },
    storage,
    getClient: getClient2,
    get state() {
      return store.getState();
    },
    setState(value) {
      let newState;
      if (typeof value === "function")
        newState = value(store.getState());
      else
        newState = value;
      const initialState = getInitialState();
      if (typeof newState !== "object")
        newState = initialState;
      const isCorrupt = Object.keys(initialState).some((x) => !(x in newState));
      if (isCorrupt)
        newState = initialState;
      store.setState(newState, true);
    },
    subscribe(selector, listener, options) {
      return store.subscribe(selector, listener, options ? {
        ...options,
        fireImmediately: options.emitImmediately
        // Workaround cast since Zustand does not support `'exactOptionalPropertyTypes'`
      } : void 0);
    },
    _internal: {
      mipd,
      async revalidate() {
        const state = store.getState();
        const connections = state.connections;
        let current = state.current;
        for (const [, connection] of connections) {
          const connector = connection.connector;
          const isAuthorized = connector.isAuthorized ? await connector.isAuthorized() : false;
          if (isAuthorized)
            continue;
          connections.delete(connector.uid);
          if (current === connector.uid)
            current = null;
        }
        store.setState((x) => ({ ...x, connections, current }));
      },
      store,
      ssr: Boolean(ssr),
      syncConnectedChain,
      transports: rest.transports,
      chains: {
        setState(value) {
          const nextChains = typeof value === "function" ? value(chains.getState()) : value;
          if (nextChains.length === 0)
            return;
          return chains.setState(nextChains, true);
        },
        subscribe(listener) {
          return chains.subscribe(listener);
        }
      },
      connectors: {
        providerDetailToConnector,
        setup,
        setState(value) {
          return connectors.setState(typeof value === "function" ? value(connectors.getState()) : value, true);
        },
        subscribe(listener) {
          return connectors.subscribe(listener);
        }
      },
      events: { change, connect: connect2, disconnect: disconnect2 }
    }
  };
}

// node_modules/@wagmi/core/dist/esm/hydrate.js
function hydrate(config, parameters) {
  const { initialState, reconnectOnMount } = parameters;
  if (initialState && !config._internal.store.persist.hasHydrated())
    config.setState({
      ...initialState,
      chainId: config.chains.some((x) => x.id === initialState.chainId) ? initialState.chainId : config.chains[0].id,
      connections: reconnectOnMount ? initialState.connections : /* @__PURE__ */ new Map(),
      status: reconnectOnMount ? "reconnecting" : "disconnected"
    });
  return {
    async onMount() {
      if (config._internal.ssr) {
        await config._internal.store.persist.rehydrate();
        if (config._internal.mipd) {
          config._internal.connectors.setState((connectors) => {
            const rdnsSet = /* @__PURE__ */ new Set();
            for (const connector of connectors ?? []) {
              if (connector.rdns) {
                const rdnsValues = Array.isArray(connector.rdns) ? connector.rdns : [connector.rdns];
                for (const rdns of rdnsValues) {
                  rdnsSet.add(rdns);
                }
              }
            }
            const mipdConnectors = [];
            const providers = config._internal.mipd?.getProviders() ?? [];
            for (const provider of providers) {
              if (rdnsSet.has(provider.info.rdns))
                continue;
              const connectorFn = config._internal.connectors.providerDetailToConnector(provider);
              const connector = config._internal.connectors.setup(connectorFn);
              mipdConnectors.push(connector);
            }
            return [...connectors, ...mipdConnectors];
          });
        }
      }
      if (reconnectOnMount)
        reconnect(config);
      else if (config.storage)
        config.setState((x) => ({
          ...x,
          connections: /* @__PURE__ */ new Map()
        }));
    }
  };
}

// node_modules/@wagmi/core/dist/esm/transports/connector.js
function unstable_connector(connector, config = {}) {
  const { type } = connector;
  const { key = "connector", name = "Connector", retryDelay } = config;
  return (parameters) => {
    const { chain, connectors } = parameters;
    const retryCount = config.retryCount ?? parameters.retryCount;
    const request = async ({ method, params }) => {
      const connector2 = connectors?.getState().find((c) => c.type === type);
      if (!connector2)
        throw new ProviderDisconnectedError(new Error(`Could not find connector of type "${type}" in \`connectors\` passed to \`createConfig\`.`));
      const provider = await connector2.getProvider({
        chainId: chain?.id
      });
      if (!provider)
        throw new ProviderDisconnectedError(new Error("Provider is disconnected."));
      const chainId = hexToNumber(await withRetry(() => withTimeout(() => provider.request({ method: "eth_chainId" }), {
        timeout: 100
      })));
      if (chain && chainId !== chain.id)
        throw new ChainDisconnectedError(new Error(`The current chain of the connector (id: ${chainId}) does not match the target chain for the request (id: ${chain.id} – ${chain.name}).`));
      const body = { method, params };
      return provider.request(body);
    };
    return createTransport({
      key,
      name,
      request,
      retryCount,
      retryDelay,
      type: "connector"
    });
  };
}

// node_modules/@wagmi/core/dist/esm/transports/fallback.js
function fallback2(transports, config) {
  return fallback(transports, config);
}

// node_modules/@wagmi/core/dist/esm/utils/cookie.js
var cookieStorage = {
  getItem(key) {
    if (typeof window === "undefined")
      return null;
    const value = parseCookie(document.cookie, key);
    return value ?? null;
  },
  setItem(key, value) {
    if (typeof window === "undefined")
      return;
    document.cookie = `${key}=${value};path=/;samesite=Lax`;
  },
  removeItem(key) {
    if (typeof window === "undefined")
      return;
    document.cookie = `${key}=;max-age=-1;path=/`;
  }
};
function cookieToInitialState(config, cookie) {
  if (!cookie)
    return void 0;
  const key = `${config.storage?.key}.store`;
  const parsed = parseCookie(cookie, key);
  if (!parsed)
    return void 0;
  return deserialize(parsed).state;
}
function parseCookie(cookie, key) {
  const keyValue = cookie.split("; ").find((x) => x.startsWith(`${key}=`));
  if (!keyValue)
    return void 0;
  return keyValue.substring(key.length + 1);
}

// node_modules/wagmi/dist/esm/hydrate.js
var import_react = __toESM(require_react(), 1);
function Hydrate(parameters) {
  const { children, config, initialState, reconnectOnMount = true } = parameters;
  const { onMount } = hydrate(config, {
    initialState,
    reconnectOnMount
  });
  if (!config._internal.ssr)
    onMount();
  const active = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    if (!active.current)
      return;
    if (!config._internal.ssr)
      return;
    onMount();
    return () => {
      active.current = false;
    };
  }, []);
  return children;
}

// node_modules/wagmi/dist/esm/context.js
var WagmiContext = (0, import_react2.createContext)(void 0);
function WagmiProvider(parameters) {
  const { children, config } = parameters;
  const props = { value: config };
  return (0, import_react2.createElement)(Hydrate, parameters, (0, import_react2.createElement)(WagmiContext.Provider, props, children));
}

// node_modules/wagmi/dist/esm/version.js
var version2 = "3.5.0";

// node_modules/wagmi/dist/esm/utils/getVersion.js
var getVersion = () => `wagmi@${version2}`;

// node_modules/wagmi/dist/esm/errors/base.js
var BaseError2 = class extends BaseError {
  constructor() {
    super(...arguments);
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "WagmiError"
    });
  }
  get docsBaseUrl() {
    return "https://wagmi.sh/react";
  }
  get version() {
    return getVersion();
  }
};

// node_modules/wagmi/dist/esm/errors/context.js
var WagmiProviderNotFoundError = class extends BaseError2 {
  constructor() {
    super("`useConfig` must be used within `WagmiProvider`.", {
      docsPath: "/api/WagmiProvider"
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "WagmiProviderNotFoundError"
    });
  }
};

// node_modules/@wagmi/core/dist/esm/query/utils.js
function structuralSharing(oldData, newData) {
  return replaceEqualDeep(oldData, newData);
}
function hashFn(queryKey) {
  return JSON.stringify(queryKey, (_, value) => {
    if (isPlainObject(value))
      return Object.keys(value).sort().reduce((result, key) => {
        result[key] = value[key];
        return result;
      }, {});
    if (typeof value === "bigint")
      return value.toString();
    return value;
  });
}
function isPlainObject(value) {
  if (!hasObjectPrototype(value)) {
    return false;
  }
  const ctor = value.constructor;
  if (typeof ctor === "undefined")
    return true;
  const prot = ctor.prototype;
  if (!hasObjectPrototype(prot))
    return false;
  if (!prot.hasOwnProperty("isPrototypeOf"))
    return false;
  return true;
}
function hasObjectPrototype(o) {
  return Object.prototype.toString.call(o) === "[object Object]";
}
function filterQueryOptions(options) {
  const {
    // import('@tanstack/query-core').QueryOptions
    // biome-ignore lint/correctness/noUnusedVariables: tossing
    _defaulted,
    behavior,
    gcTime,
    initialData,
    initialDataUpdatedAt,
    maxPages,
    meta,
    networkMode,
    queryFn,
    queryHash,
    queryKey,
    queryKeyHashFn,
    retry,
    retryDelay,
    structuralSharing: structuralSharing2,
    // import('@tanstack/query-core').InfiniteQueryObserverOptions
    // biome-ignore lint/correctness/noUnusedVariables: tossing
    getPreviousPageParam,
    getNextPageParam,
    initialPageParam,
    // import('@tanstack/react-query').UseQueryOptions
    // biome-ignore lint/correctness/noUnusedVariables: tossing
    _optimisticResults,
    enabled,
    notifyOnChangeProps,
    placeholderData,
    refetchInterval,
    refetchIntervalInBackground,
    refetchOnMount,
    refetchOnReconnect,
    refetchOnWindowFocus,
    retryOnMount,
    select,
    staleTime,
    suspense,
    throwOnError,
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // wagmi
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // biome-ignore lint/correctness/noUnusedVariables: tossing
    abi,
    config,
    connector,
    query,
    watch,
    ...rest
  } = options;
  if (connector)
    return { connectorUid: connector?.uid, ...rest };
  return rest;
}

// node_modules/@wagmi/core/dist/esm/query/call.js
function callQueryOptions(config, options = {}) {
  return {
    ...options.query,
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      const data = await call(config, {
        ...parameters
      });
      return data ?? null;
    },
    queryKey: callQueryKey(options)
  };
}
function callQueryKey(options = {}) {
  return ["call", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/connect.js
function connectMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn: async (variables) => {
      return connect(config, variables);
    },
    mutationKey: ["connect"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/deployContract.js
function deployContractMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return deployContract(config, variables);
    },
    mutationKey: ["deployContract"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/disconnect.js
function disconnectMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn: async (variables) => {
      return disconnect(config, variables);
    },
    mutationKey: ["disconnect"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/estimateFeesPerGas.js
function estimateFeesPerGasQueryOptions(config, options = {}) {
  return {
    ...options.query,
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      return estimateFeesPerGas(config, parameters);
    },
    queryKey: estimateFeesPerGasQueryKey(options)
  };
}
function estimateFeesPerGasQueryKey(options = {}) {
  return ["estimateFeesPerGas", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/estimateGas.js
function estimateGasQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean((options.account || options.connector) && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.account && !options.connector)
        throw new Error("account or connector is required");
      return estimateGas(config, {
        ...parameters,
        account: parameters.account,
        connector: options.connector
      });
    },
    queryKey: estimateGasQueryKey(options)
  };
}
function estimateGasQueryKey(options = {}) {
  return ["estimateGas", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/estimateMaxPriorityFeePerGas.js
function estimateMaxPriorityFeePerGasQueryOptions(config, options = {}) {
  return {
    ...options.query,
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      return estimateMaxPriorityFeePerGas(config, parameters);
    },
    queryKey: estimateMaxPriorityFeePerGasQueryKey(options)
  };
}
function estimateMaxPriorityFeePerGasQueryKey(options = {}) {
  return ["estimateMaxPriorityFeePerGas", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getBalance.js
function getBalanceQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.address && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.address)
        throw new Error("address is required");
      const balance = await getBalance(config, {
        ...parameters,
        address: parameters.address
      });
      return balance ?? null;
    },
    queryKey: getBalanceQueryKey(options)
  };
}
function getBalanceQueryKey(options = {}) {
  return ["balance", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getBlobBaseFee.js
function getBlobBaseFeeQueryOptions(config, options = {}) {
  return {
    ...options.query,
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      const blobBaseFee = await getBlobBaseFee(config, parameters);
      return blobBaseFee ?? null;
    },
    queryKey: getBlobBaseFeeQueryKey(options)
  };
}
function getBlobBaseFeeQueryKey(options = {}) {
  return ["blobBaseFee", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getBlock.js
function getBlockQueryOptions(config, options = {}) {
  return {
    ...options.query,
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      const block = await getBlock(config, parameters);
      return block ?? null;
    },
    queryKey: getBlockQueryKey(options)
  };
}
function getBlockQueryKey(options = {}) {
  return ["block", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getBlockNumber.js
function getBlockNumberQueryOptions(config, options = {}) {
  return {
    ...options.query,
    gcTime: 0,
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      const blockNumber = await getBlockNumber(config, parameters);
      return blockNumber ?? null;
    },
    queryKey: getBlockNumberQueryKey(options)
  };
}
function getBlockNumberQueryKey(options = {}) {
  return ["blockNumber", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getBlockTransactionCount.js
function getBlockTransactionCountQueryOptions(config, options = {}) {
  return {
    ...options.query,
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      const blockTransactionCount = await getBlockTransactionCount(config, parameters);
      return blockTransactionCount ?? null;
    },
    queryKey: getBlockTransactionCountQueryKey(options)
  };
}
function getBlockTransactionCountQueryKey(options = {}) {
  return ["blockTransactionCount", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getBytecode.js
function getBytecodeQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.address && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.address)
        throw new Error("address is required");
      const bytecode = await getBytecode(config, {
        ...parameters,
        address: parameters.address
      });
      return bytecode ?? null;
    },
    queryKey: getBytecodeQueryKey(options)
  };
}
function getBytecodeQueryKey(options = {}) {
  return ["getBytecode", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getCallsStatus.js
function getCallsStatusQueryOptions(config, options) {
  return {
    ...options.query,
    enabled: Boolean(options.connector?.getProvider && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      if (!options.connector?.getProvider)
        throw new Error("connector is required");
      const [, { connectorUid: _, scopeKey: __, ...parameters }] = context.queryKey;
      const status = await getCallsStatus(config, parameters);
      return status;
    },
    queryKey: getCallsStatusQueryKey(options)
  };
}
function getCallsStatusQueryKey(options) {
  return ["callsStatus", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getCapabilities.js
function getCapabilitiesQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.connector?.getProvider && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      if (!options.connector?.getProvider)
        throw new Error("connector is required");
      const [, { connectorUid: _, scopeKey: __, ...parameters }] = context.queryKey;
      const capabilities = await getCapabilities(config, parameters);
      return capabilities;
    },
    queryKey: getCapabilitiesQueryKey(options)
  };
}
function getCapabilitiesQueryKey(options = {}) {
  return ["capabilities", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getConnectorClient.js
function getConnectorClientQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.connector?.getProvider && (options.query?.enabled ?? true)),
    gcTime: 0,
    queryFn: async (context) => {
      const [, { connectorUid: _, scopeKey: __, ...parameters }] = context.queryKey;
      return getConnectorClient(config, {
        ...parameters,
        connector: options.connector
      });
    },
    queryKey: getConnectorClientQueryKey(options),
    staleTime: Number.POSITIVE_INFINITY
  };
}
function getConnectorClientQueryKey(options = {}) {
  return ["connectorClient", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getContractEvents.js
function getContractEventsQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.abi && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      if (!options.abi)
        throw new Error("abi is required");
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      const result = await getContractEvents(config, {
        ...parameters,
        abi: options.abi
      });
      return result;
    },
    queryKey: getContractEventsQueryKey(options),
    structuralSharing
  };
}
function getContractEventsQueryKey(options = {}) {
  return ["getContractEvents", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getEnsAddress.js
function getEnsAddressQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.name && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.name)
        throw new Error("name is required");
      return getEnsAddress(config, { ...parameters, name: parameters.name });
    },
    queryKey: getEnsAddressQueryKey(options)
  };
}
function getEnsAddressQueryKey(options = {}) {
  return ["ensAddress", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getEnsAvatar.js
function getEnsAvatarQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.name && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.name)
        throw new Error("name is required");
      return getEnsAvatar(config, { ...parameters, name: parameters.name });
    },
    queryKey: getEnsAvatarQueryKey(options)
  };
}
function getEnsAvatarQueryKey(options = {}) {
  return ["ensAvatar", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getEnsName.js
function getEnsNameQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.address && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.address)
        throw new Error("address is required");
      return getEnsName(config, { ...parameters, address: parameters.address });
    },
    queryKey: getEnsNameQueryKey(options)
  };
}
function getEnsNameQueryKey(options = {}) {
  return ["ensName", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getEnsResolver.js
function getEnsResolverQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.name && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.name)
        throw new Error("name is required");
      return getEnsResolver(config, { ...parameters, name: parameters.name });
    },
    queryKey: getEnsResolverQueryKey(options)
  };
}
function getEnsResolverQueryKey(options = {}) {
  return ["ensResolver", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getEnsText.js
function getEnsTextQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.key && options.name && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.key || !parameters.name)
        throw new Error("key and name are required");
      return getEnsText(config, {
        ...parameters,
        key: parameters.key,
        name: parameters.name
      });
    },
    queryKey: getEnsTextQueryKey(options)
  };
}
function getEnsTextQueryKey(options = {}) {
  return ["ensText", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getFeeHistory.js
function getFeeHistoryQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.blockCount && options.rewardPercentiles && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.blockCount)
        throw new Error("blockCount is required");
      if (!parameters.rewardPercentiles)
        throw new Error("rewardPercentiles is required");
      const feeHistory = await getFeeHistory(config, {
        ...parameters,
        blockCount: parameters.blockCount,
        rewardPercentiles: parameters.rewardPercentiles
      });
      return feeHistory ?? null;
    },
    queryKey: getFeeHistoryQueryKey(options)
  };
}
function getFeeHistoryQueryKey(options = {}) {
  return ["feeHistory", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getGasPrice.js
function getGasPriceQueryOptions(config, options = {}) {
  return {
    ...options.query,
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      const gasPrice = await getGasPrice(config, parameters);
      return gasPrice ?? null;
    },
    queryKey: getGasPriceQueryKey(options)
  };
}
function getGasPriceQueryKey(options = {}) {
  return ["gasPrice", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getProof.js
function getProofQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.address && options.storageKeys && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.address || !parameters.storageKeys)
        throw new Error("address and storageKeys are required");
      return getProof(config, {
        ...parameters,
        address: parameters.address,
        storageKeys: parameters.storageKeys
      });
    },
    queryKey: getProofQueryKey(options)
  };
}
function getProofQueryKey(options = {}) {
  return ["getProof", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getStorageAt.js
function getStorageAtQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.address && options.slot && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.address || !parameters.slot)
        throw new Error("address and slot are required");
      return getStorageAt(config, {
        ...parameters,
        address: parameters.address,
        slot: parameters.slot
      });
    },
    queryKey: getStorageAtQueryKey(options)
  };
}
function getStorageAtQueryKey(options = {}) {
  return ["getStorageAt", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getTransaction.js
function getTransactionQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean((options.hash || options.index && (options.blockHash || options.blockNumber || options.blockTag)) && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!(parameters.hash || parameters.index && (parameters.blockHash || parameters.blockNumber || parameters.blockTag)))
        throw new Error("hash OR index AND blockHash, blockNumber, blockTag is required");
      return getTransaction(config, parameters);
    },
    queryKey: getTransactionQueryKey(options)
  };
}
function getTransactionQueryKey(options = {}) {
  return ["transaction", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getTransactionConfirmations.js
function getTransactionConfirmationsQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean((options.hash || options.transactionReceipt) && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.hash && !parameters.transactionReceipt)
        throw new Error("hash or transactionReceipt is required");
      const confirmations = await getTransactionConfirmations(config, {
        ...parameters,
        hash: parameters.hash,
        transactionReceipt: parameters.transactionReceipt
      });
      return confirmations ?? null;
    },
    queryKey: getTransactionConfirmationsQueryKey(options)
  };
}
function getTransactionConfirmationsQueryKey(options = {}) {
  return ["transactionConfirmations", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getTransactionCount.js
function getTransactionCountQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.address && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.address)
        throw new Error("address is required");
      const transactionCount = await getTransactionCount(config, {
        ...parameters,
        address: parameters.address
      });
      return transactionCount ?? null;
    },
    queryKey: getTransactionCountQueryKey(options)
  };
}
function getTransactionCountQueryKey(options = {}) {
  return ["transactionCount", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getTransactionReceipt.js
function getTransactionReceiptQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.hash && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.hash)
        throw new Error("hash is required");
      return getTransactionReceipt(config, {
        ...parameters,
        hash: parameters.hash
      });
    },
    queryKey: getTransactionReceiptQueryKey(options)
  };
}
function getTransactionReceiptQueryKey(options = {}) {
  return ["getTransactionReceipt", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/getWalletClient.js
function getWalletClientQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.connector?.getProvider && (options.query?.enabled ?? true)),
    gcTime: 0,
    queryFn: async (context) => {
      if (!options.connector?.getProvider)
        throw new Error("connector is required");
      const [, { connectorUid: _, scopeKey: __, ...parameters }] = context.queryKey;
      return getWalletClient(config, {
        ...parameters,
        connector: options.connector
      });
    },
    queryKey: getWalletClientQueryKey(options),
    staleTime: Number.POSITIVE_INFINITY
  };
}
function getWalletClientQueryKey(options = {}) {
  return ["walletClient", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/infiniteReadContracts.js
function infiniteReadContractsQueryOptions(config, options) {
  return {
    ...options.query,
    async queryFn({ pageParam, queryKey }) {
      const { contracts } = options;
      const { cacheKey: _, scopeKey: _s, ...parameters } = queryKey[1];
      return await readContracts(config, {
        ...parameters,
        contracts: contracts(pageParam)
      });
    },
    queryKey: infiniteReadContractsQueryKey(options)
  };
}
function infiniteReadContractsQueryKey(options) {
  const { contracts: _, ...parameters } = options;
  return ["infiniteReadContracts", filterQueryOptions(parameters)];
}

// node_modules/@wagmi/core/dist/esm/query/prepareTransactionRequest.js
function prepareTransactionRequestQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.to && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.to)
        throw new Error("to is required");
      return prepareTransactionRequest(config, {
        ...parameters,
        to: parameters.to
      });
    },
    queryKey: prepareTransactionRequestQueryKey(options)
  };
}
function prepareTransactionRequestQueryKey(options = {}) {
  return ["prepareTransactionRequest", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/readContract.js
function readContractQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(Boolean(options.address || "code" in options && options.code) && options.abi && options.functionName && (options.query?.enabled ?? true)),
    // TODO: Support `signal` once Viem actions allow passthrough
    // https://tkdodo.eu/blog/why-you-want-react-query#bonus-cancellation
    queryFn: async (context) => {
      if (!options.abi)
        throw new Error("abi is required");
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.functionName)
        throw new Error("functionName is required");
      const result = await readContract(config, {
        ...parameters,
        abi: options.abi,
        address: parameters.address,
        code: "code" in parameters && parameters.code ? parameters.code : void 0,
        functionName: parameters.functionName
      });
      return result;
    },
    queryKey: readContractQueryKey(options),
    structuralSharing
  };
}
function readContractQueryKey(options = {}) {
  return ["readContract", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/readContracts.js
function readContractsQueryOptions(config, options = {}) {
  return {
    ...options.query,
    queryFn: async (context) => {
      const contracts = [];
      const length = context.queryKey[1].contracts.length;
      for (let i = 0; i < length; i++) {
        const contract = context.queryKey[1].contracts[i];
        const abi = (options.contracts?.[i]).abi;
        contracts.push({ ...contract, abi });
      }
      const { scopeKey: _, ...parameters } = context.queryKey[1];
      return readContracts(config, {
        ...parameters,
        contracts
      });
    },
    queryKey: readContractsQueryKey(options)
  };
}
function readContractsQueryKey(options = {}) {
  const contracts = [];
  let hasContractWithoutChainId = false;
  for (const contract of options.contracts ?? []) {
    const { abi: _2, ...rest2 } = contract;
    if (rest2.chainId === void 0)
      hasContractWithoutChainId = true;
    const chainId = rest2.chainId ?? options.chainId;
    contracts.push({ ...rest2, ...chainId ? { chainId } : {} });
  }
  const { chainId: _, ...rest } = options;
  return [
    "readContracts",
    filterQueryOptions({
      ...rest,
      ...hasContractWithoutChainId && options.chainId ? { chainId: options.chainId } : {},
      contracts
    })
  ];
}

// node_modules/@wagmi/core/dist/esm/query/reconnect.js
function reconnectMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return reconnect(config, variables);
    },
    mutationKey: ["reconnect"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/sendCalls.js
function sendCallsMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return sendCalls(config, variables);
    },
    mutationKey: ["sendCalls"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/sendCallsSync.js
function sendCallsSyncMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return sendCallsSync2(config, variables);
    },
    mutationKey: ["sendCallsSync"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/sendTransaction.js
function sendTransactionMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return sendTransaction(config, variables);
    },
    mutationKey: ["sendTransaction"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/sendTransactionSync.js
function sendTransactionSyncMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return sendTransactionSync2(config, variables);
    },
    mutationKey: ["sendTransactionSync"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/showCallsStatus.js
function showCallsStatusMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return showCallsStatus(config, variables);
    },
    mutationKey: ["showCallsStatus"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/signMessage.js
function signMessageMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return signMessage(config, variables);
    },
    mutationKey: ["signMessage"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/signTransaction.js
function signTransactionMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return signTransaction(config, variables);
    },
    mutationKey: ["signTransaction"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/signTypedData.js
function signTypedDataMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return signTypedData(config, variables);
    },
    mutationKey: ["signTypedData"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/simulateContract.js
function simulateContractQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.abi && options.address && options.connector && options.functionName && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      if (!options.abi)
        throw new Error("abi is required");
      if (!options.connector)
        throw new Error("connector is required");
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.address)
        throw new Error("address is required");
      if (!parameters.functionName)
        throw new Error("functionName is required");
      return simulateContract(config, {
        ...parameters,
        abi: options.abi,
        address: parameters.address,
        connector: options.connector,
        functionName: parameters.functionName
      });
    },
    queryKey: simulateContractQueryKey(options)
  };
}
function simulateContractQueryKey(options = {}) {
  const { connector: _, ...rest } = options;
  return ["simulateContract", filterQueryOptions(rest)];
}

// node_modules/@wagmi/core/dist/esm/query/switchChain.js
function switchChainMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return switchChain(config, variables);
    },
    mutationKey: ["switchChain"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/switchConnection.js
function switchConnectionMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return switchConnection(config, variables);
    },
    mutationKey: ["switchConnection"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/verifyMessage.js
function verifyMessageQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.address && options.message && options.signature && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.address)
        throw new Error("address is required");
      if (!parameters.message)
        throw new Error("message is required");
      if (!parameters.signature)
        throw new Error("signature is required");
      const verified = await verifyMessage(config, {
        ...parameters,
        address: parameters.address,
        message: parameters.message,
        signature: parameters.signature
      });
      return verified ?? null;
    },
    queryKey: verifyMessageQueryKey(options)
  };
}
function verifyMessageQueryKey(options = {}) {
  return ["verifyMessage", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/verifyTypedData.js
function verifyTypedDataQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.address && options.message && options.primaryType && options.signature && options.types && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.address)
        throw new Error("address is required");
      if (!parameters.message)
        throw new Error("message is required");
      if (!parameters.primaryType)
        throw new Error("primaryType is required");
      if (!parameters.signature)
        throw new Error("signature is required");
      if (!parameters.types)
        throw new Error("types is required");
      const verified = await verifyTypedData(config, {
        ...parameters,
        address: parameters.address,
        message: parameters.message,
        primaryType: parameters.primaryType,
        signature: parameters.signature,
        types: parameters.types
      });
      return verified ?? null;
    },
    queryKey: verifyTypedDataQueryKey(options)
  };
}
function verifyTypedDataQueryKey(options = {}) {
  return ["verifyTypedData", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/waitForCallsStatus.js
function waitForCallsStatusQueryOptions(config, options) {
  return {
    ...options.query,
    enabled: Boolean(options.id && options.connector?.getProvider && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      if (!options.connector?.getProvider)
        throw new Error("connector is required");
      const [, { connectorUid: _, scopeKey: __, ...parameters }] = context.queryKey;
      if (!parameters.id)
        throw new Error("id is required");
      const status = await waitForCallsStatus(config, {
        ...parameters,
        id: parameters.id
      });
      return status;
    },
    queryKey: waitForCallsStatusQueryKey(options)
  };
}
function waitForCallsStatusQueryKey(options = {}) {
  return ["callsStatus", filterQueryOptions(options)];
}

// node_modules/@wagmi/core/dist/esm/query/waitForTransactionReceipt.js
function waitForTransactionReceiptQueryOptions(config, options = {}) {
  return {
    ...options.query,
    enabled: Boolean(options.hash && (options.query?.enabled ?? true)),
    queryFn: async (context) => {
      const [, { scopeKey: _, ...parameters }] = context.queryKey;
      if (!parameters.hash)
        throw new Error("hash is required");
      return waitForTransactionReceipt(config, {
        ...parameters,
        onReplaced: options.onReplaced,
        hash: parameters.hash
      });
    },
    queryKey: waitForTransactionReceiptQueryKey(options)
  };
}
function waitForTransactionReceiptQueryKey(options = {}) {
  const { onReplaced: _, ...rest } = options;
  return ["waitForTransactionReceipt", filterQueryOptions(rest)];
}

// node_modules/@wagmi/core/dist/esm/query/watchAsset.js
function watchAssetMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return watchAsset(config, variables);
    },
    mutationKey: ["watchAsset"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/writeContract.js
function writeContractMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return writeContract(config, variables);
    },
    mutationKey: ["writeContract"]
  };
}

// node_modules/@wagmi/core/dist/esm/query/writeContractSync.js
function writeContractSyncMutationOptions(config, options = {}) {
  return {
    ...options.mutation,
    mutationFn(variables) {
      return writeContractSync2(config, variables);
    },
    mutationKey: ["writeContractSync"]
  };
}

// node_modules/wagmi/dist/esm/utils/query.js
function useQuery2(parameters) {
  const result = useQuery({
    ...parameters,
    queryKeyHashFn: hashFn
    // for bigint support
  });
  result.queryKey = parameters.queryKey;
  return result;
}
function useInfiniteQuery2(parameters) {
  const result = useInfiniteQuery({
    ...parameters,
    queryKeyHashFn: hashFn
    // for bigint support
  });
  result.queryKey = parameters.queryKey;
  return result;
}

// node_modules/wagmi/dist/esm/hooks/useChainId.js
var import_react4 = __toESM(require_react(), 1);

// node_modules/wagmi/dist/esm/hooks/useConfig.js
var import_react3 = __toESM(require_react(), 1);
function useConfig(parameters = {}) {
  const config = parameters.config ?? (0, import_react3.useContext)(WagmiContext);
  if (!config)
    throw new WagmiProviderNotFoundError();
  return config;
}

// node_modules/wagmi/dist/esm/hooks/useChainId.js
function useChainId(parameters = {}) {
  const config = useConfig(parameters);
  return (0, import_react4.useSyncExternalStore)((onChange) => watchChainId(config, { onChange }), () => getChainId(config), () => getChainId(config));
}

// node_modules/wagmi/dist/esm/hooks/useBalance.js
function useBalance(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getBalanceQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useBlobBaseFee.js
function useBlobBaseFee(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getBlobBaseFeeQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useWatchBlocks.js
var import_react5 = __toESM(require_react(), 1);
function useWatchBlocks(parameters = {}) {
  const { enabled = true, onBlock, config: _, ...rest } = parameters;
  const config = useConfig(parameters);
  const configChainId = useChainId({ config });
  const chainId = parameters.chainId ?? configChainId;
  const onBlockRef = (0, import_react5.useRef)(onBlock);
  const onErrorRef = (0, import_react5.useRef)(rest.onError);
  onBlockRef.current = onBlock;
  onErrorRef.current = rest.onError;
  (0, import_react5.useEffect)(() => {
    if (!enabled)
      return;
    if (!onBlockRef.current)
      return;
    return watchBlocks(config, {
      ...rest,
      chainId,
      onBlock: (block, prevBlock) => onBlockRef.current?.(block, prevBlock),
      onError: (error) => onErrorRef.current?.(error)
    });
  }, [
    chainId,
    config,
    enabled,
    ///
    rest.blockTag,
    rest.emitMissed,
    rest.emitOnBegin,
    rest.includeTransactions,
    rest.poll,
    rest.pollingInterval,
    rest.syncConnectedChain
  ]);
}

// node_modules/wagmi/dist/esm/hooks/useBlock.js
function useBlock(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getBlockQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  const queryClient = useQueryClient();
  useWatchBlocks({
    ...{
      config: parameters.config,
      chainId: parameters.chainId,
      ...typeof parameters.watch === "object" ? parameters.watch : {}
    },
    enabled: Boolean((options.enabled ?? true) && (typeof parameters.watch === "object" ? parameters.watch.enabled : parameters.watch)),
    onBlock(block) {
      queryClient.setQueryData(options.queryKey, block);
    }
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useWatchBlockNumber.js
var import_react6 = __toESM(require_react(), 1);
function useWatchBlockNumber(parameters = {}) {
  const { enabled = true, onBlockNumber, config: _, ...rest } = parameters;
  const config = useConfig(parameters);
  const configChainId = useChainId({ config });
  const chainId = parameters.chainId ?? configChainId;
  const onBlockNumberRef = (0, import_react6.useRef)(onBlockNumber);
  const onErrorRef = (0, import_react6.useRef)(rest.onError);
  onBlockNumberRef.current = onBlockNumber;
  onErrorRef.current = rest.onError;
  (0, import_react6.useEffect)(() => {
    if (!enabled)
      return;
    if (!onBlockNumberRef.current)
      return;
    return watchBlockNumber(config, {
      ...rest,
      chainId,
      onBlockNumber: (blockNumber, prevBlockNumber) => onBlockNumberRef.current?.(blockNumber, prevBlockNumber),
      onError: (error) => onErrorRef.current?.(error)
    });
  }, [
    chainId,
    config,
    enabled,
    ///
    rest.emitMissed,
    rest.emitOnBegin,
    rest.poll,
    rest.pollingInterval,
    rest.syncConnectedChain
  ]);
}

// node_modules/wagmi/dist/esm/hooks/useBlockNumber.js
function useBlockNumber(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getBlockNumberQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  const queryClient = useQueryClient();
  useWatchBlockNumber({
    ...{
      config: parameters.config,
      chainId: parameters.chainId,
      ...typeof parameters.watch === "object" ? parameters.watch : {}
    },
    enabled: Boolean((options.enabled ?? true) && (typeof parameters.watch === "object" ? parameters.watch.enabled : parameters.watch)),
    onBlockNumber(blockNumber) {
      queryClient.setQueryData(options.queryKey, blockNumber);
    }
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useBlockTransactionCount.js
function useBlockTransactionCount(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getBlockTransactionCountQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useBytecode.js
function useBytecode(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getBytecodeQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useCall.js
function useCall(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = callQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/@wagmi/core/dist/esm/actions/watchChains.js
function watchChains(config, parameters) {
  const { onChange } = parameters;
  return config._internal.chains.subscribe((chains, prevChains) => {
    onChange(chains, prevChains);
  });
}

// node_modules/wagmi/dist/esm/hooks/useSyncExternalStoreWithTracked.js
var import_react7 = __toESM(require_react(), 1);
var import_with_selector = __toESM(require_with_selector(), 1);
var isPlainObject2 = (obj) => typeof obj === "object" && !Array.isArray(obj);
function useSyncExternalStoreWithTracked(subscribe, getSnapshot, getServerSnapshot = getSnapshot, isEqual = deepEqual) {
  const trackedKeys = (0, import_react7.useRef)([]);
  const result = (0, import_with_selector.useSyncExternalStoreWithSelector)(subscribe, getSnapshot, getServerSnapshot, (x) => x, (a, b) => {
    if (isPlainObject2(a) && isPlainObject2(b) && trackedKeys.current.length) {
      for (const key of trackedKeys.current) {
        const equal = isEqual(a[key], b[key]);
        if (!equal)
          return false;
      }
      return true;
    }
    return isEqual(a, b);
  });
  return (0, import_react7.useMemo)(() => {
    if (isPlainObject2(result)) {
      const trackedResult = { ...result };
      let properties = {};
      for (const [key, value] of Object.entries(trackedResult)) {
        properties = {
          ...properties,
          [key]: {
            configurable: false,
            enumerable: true,
            get: () => {
              if (!trackedKeys.current.includes(key)) {
                trackedKeys.current.push(key);
              }
              return value;
            }
          }
        };
      }
      Object.defineProperties(trackedResult, properties);
      return trackedResult;
    }
    return result;
  }, [result]);
}

// node_modules/wagmi/dist/esm/hooks/useConnection.js
function useConnection(parameters = {}) {
  const config = useConfig(parameters);
  return useSyncExternalStoreWithTracked((onChange) => watchConnection(config, { onChange }), () => getConnection(config));
}

// node_modules/wagmi/dist/esm/hooks/useCallsStatus.js
function useCallsStatus(parameters) {
  const config = useConfig(parameters);
  const { connector } = useConnection({ config });
  const options = getCallsStatusQueryOptions(config, {
    ...parameters,
    connector: parameters.connector ?? connector
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useCapabilities.js
function useCapabilities(parameters = {}) {
  const config = useConfig(parameters);
  const { address, connector } = useConnection({ config });
  const options = getCapabilitiesQueryOptions(config, {
    ...parameters,
    account: parameters.account ?? address,
    connector: parameters.connector ?? connector
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useChains.js
var import_react8 = __toESM(require_react(), 1);
function useChains(parameters = {}) {
  const config = useConfig(parameters);
  return (0, import_react8.useSyncExternalStore)((onChange) => watchChains(config, { onChange }), () => getChains(config), () => getChains(config));
}

// node_modules/wagmi/dist/esm/hooks/useClient.js
var import_with_selector2 = __toESM(require_with_selector(), 1);
function useClient(parameters = {}) {
  const config = useConfig(parameters);
  return (0, import_with_selector2.useSyncExternalStoreWithSelector)((onChange) => watchClient(config, { onChange }), () => getClient(config, parameters), () => getClient(config, parameters), (x) => x, (a, b) => a?.uid === b?.uid);
}

// node_modules/wagmi/dist/esm/hooks/useConnect.js
var import_react10 = __toESM(require_react(), 1);

// node_modules/wagmi/dist/esm/hooks/useConnectors.js
var import_react9 = __toESM(require_react(), 1);
function useConnectors(parameters = {}) {
  const config = useConfig(parameters);
  return (0, import_react9.useSyncExternalStore)((onChange) => watchConnectors(config, { onChange }), () => getConnectors(config), () => getConnectors(config));
}

// node_modules/wagmi/dist/esm/hooks/useConnect.js
function useConnect(parameters = {}) {
  const config = useConfig(parameters);
  const options = connectMutationOptions(config, parameters);
  const mutation = useMutation(options);
  (0, import_react10.useEffect)(() => {
    return config.subscribe(({ status }) => status, (status, previousStatus) => {
      if (previousStatus === "connected" && status === "disconnected")
        mutation.reset();
    });
  }, [config, mutation.reset]);
  return {
    ...mutation,
    connect: mutation.mutate,
    connectAsync: mutation.mutateAsync,
    connectors: useConnectors({ config })
  };
}

// node_modules/wagmi/dist/esm/hooks/useConnectionEffect.js
var import_react11 = __toESM(require_react(), 1);
function useConnectionEffect(parameters = {}) {
  const { onConnect, onDisconnect } = parameters;
  const config = useConfig(parameters);
  (0, import_react11.useEffect)(() => {
    return watchConnection(config, {
      onChange(data, prevData) {
        if ((prevData.status === "reconnecting" || prevData.status === "connecting" && prevData.address === void 0) && data.status === "connected") {
          const { address, addresses, chain, chainId, connector } = data;
          const isReconnected = prevData.status === "reconnecting" || // if `previousAccount.status` is `undefined`, the connector connected immediately.
          prevData.status === void 0;
          onConnect?.({
            address,
            addresses,
            chain,
            chainId,
            connector,
            isReconnected
          });
        } else if (prevData.status === "connected" && data.status === "disconnected")
          onDisconnect?.();
      }
    });
  }, [config, onConnect, onDisconnect]);
}

// node_modules/wagmi/dist/esm/hooks/useConnections.js
var import_react12 = __toESM(require_react(), 1);
function useConnections(parameters = {}) {
  const config = useConfig(parameters);
  return (0, import_react12.useSyncExternalStore)((onChange) => watchConnections(config, { onChange }), () => getConnections(config), () => getConnections(config));
}

// node_modules/wagmi/dist/esm/hooks/useConnectorClient.js
var import_react13 = __toESM(require_react(), 1);
function useConnectorClient(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const { address, connector } = useConnection({ config });
  const options = getConnectorClientQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
    connector: parameters.connector ?? connector,
    query: parameters.query
  });
  const addressRef = (0, import_react13.useRef)(address);
  const queryClient = useQueryClient();
  (0, import_react13.useEffect)(() => {
    const previousAddress = addressRef.current;
    if (!address && previousAddress) {
      queryClient.removeQueries({ queryKey: options.queryKey });
      addressRef.current = void 0;
    } else if (address !== previousAddress) {
      queryClient.invalidateQueries({ queryKey: options.queryKey });
      addressRef.current = address;
    }
  }, [address, queryClient]);
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useContractEvents.js
function useContractEvents(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getContractEventsQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useDeployContract.js
function useDeployContract(parameters = {}) {
  const config = useConfig(parameters);
  const options = deployContractMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    deployContract: mutation.mutate,
    deployContractAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useDisconnect.js
function useDisconnect(parameters = {}) {
  const config = useConfig(parameters);
  const options = disconnectMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    connectors: useConnections({ config }).map((connection) => connection.connector),
    disconnect: mutation.mutate,
    disconnectAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useEnsAddress.js
function useEnsAddress(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getEnsAddressQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useEnsAvatar.js
function useEnsAvatar(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getEnsAvatarQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useEnsName.js
function useEnsName(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getEnsNameQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useEnsResolver.js
function useEnsResolver(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getEnsResolverQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useEnsText.js
function useEnsText(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getEnsTextQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useEstimateFeesPerGas.js
function useEstimateFeesPerGas(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = estimateFeesPerGasQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useEstimateGas.js
function useEstimateGas(parameters = {}) {
  const config = useConfig(parameters);
  const { address, connector } = useConnection();
  const chainId = useChainId({ config });
  const options = estimateGasQueryOptions(config, {
    ...parameters,
    account: parameters.account ?? address,
    chainId: parameters.chainId ?? chainId,
    connector: parameters.connector ?? connector
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useEstimateMaxPriorityFeePerGas.js
function useEstimateMaxPriorityFeePerGas(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = estimateMaxPriorityFeePerGasQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useFeeHistory.js
function useFeeHistory(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getFeeHistoryQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useGasPrice.js
function useGasPrice(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getGasPriceQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useInfiniteReadContracts.js
function useInfiniteReadContracts(parameters) {
  const { contracts = [], query } = parameters;
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = infiniteReadContractsQueryOptions(config, {
    ...parameters,
    chainId,
    contracts,
    query
  });
  return useInfiniteQuery2({
    ...query,
    ...options,
    initialPageParam: options.initialPageParam,
    structuralSharing: query.structuralSharing ?? structuralSharing
  });
}

// node_modules/wagmi/dist/esm/hooks/usePrepareTransactionRequest.js
function usePrepareTransactionRequest(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = prepareTransactionRequestQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useProof.js
function useProof(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getProofQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/usePublicClient.js
var import_with_selector3 = __toESM(require_with_selector(), 1);
function usePublicClient(parameters = {}) {
  const config = useConfig(parameters);
  return (0, import_with_selector3.useSyncExternalStoreWithSelector)((onChange) => watchPublicClient(config, { onChange }), () => getPublicClient(config, parameters), () => getPublicClient(config, parameters), (x) => x, (a, b) => a?.uid === b?.uid);
}

// node_modules/wagmi/dist/esm/hooks/useReadContract.js
function useReadContract(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = readContractQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useReadContracts.js
var import_react14 = __toESM(require_react(), 1);
function useReadContracts(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const contractsChainId = (0, import_react14.useMemo)(() => {
    const firstChainId = parameters.contracts?.[0]?.chainId;
    if ((parameters.contracts ?? []).every((contract) => contract.chainId === firstChainId))
      return firstChainId;
    return void 0;
  }, [parameters.contracts]);
  const options = readContractsQueryOptions(config, {
    ...parameters,
    chainId: contractsChainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useReconnect.js
function useReconnect(parameters = {}) {
  const config = useConfig(parameters);
  const options = reconnectMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    connectors: config.connectors,
    reconnect: mutation.mutate,
    reconnectAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useSendCalls.js
function useSendCalls(parameters = {}) {
  const config = useConfig(parameters);
  const options = sendCallsMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    sendCalls: mutation.mutate,
    sendCallsAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useSendCallsSync.js
function useSendCallsSync(parameters = {}) {
  const config = useConfig(parameters);
  const options = sendCallsSyncMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    sendCallsSync: mutation.mutate,
    sendCallsSyncAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useSendTransaction.js
function useSendTransaction(parameters = {}) {
  const config = useConfig(parameters);
  const options = sendTransactionMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    sendTransaction: mutation.mutate,
    sendTransactionAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useSendTransactionSync.js
function useSendTransactionSync(parameters = {}) {
  const config = useConfig(parameters);
  const options = sendTransactionSyncMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    sendTransactionSync: mutation.mutate,
    sendTransactionSyncAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useShowCallsStatus.js
function useShowCallsStatus(parameters = {}) {
  const config = useConfig(parameters);
  const options = showCallsStatusMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    showCallsStatus: mutation.mutate,
    showCallsStatusAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useSignMessage.js
function useSignMessage(parameters = {}) {
  const config = useConfig(parameters);
  const options = signMessageMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    signMessage: mutation.mutate,
    signMessageAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useSignTransaction.js
function useSignTransaction(parameters = {}) {
  const config = useConfig(parameters);
  const options = signTransactionMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    signTransaction: mutation.mutate,
    signTransactionAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useSignTypedData.js
function useSignTypedData(parameters = {}) {
  const config = useConfig(parameters);
  const options = signTypedDataMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    signTypedData: mutation.mutate,
    signTypedDataAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useSimulateContract.js
function useSimulateContract(parameters = {}) {
  const config = useConfig(parameters);
  const { address, connector } = useConnection();
  const chainId = useChainId({ config });
  const options = simulateContractQueryOptions(config, {
    ...parameters,
    account: parameters.account ?? address,
    chainId: parameters.chainId ?? chainId,
    connector: parameters.connector ?? connector
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useStorageAt.js
function useStorageAt(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getStorageAtQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useSwitchChain.js
function useSwitchChain(parameters = {}) {
  const config = useConfig(parameters);
  const options = switchChainMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    chains: useChains({ config }),
    switchChain: mutation.mutate,
    switchChainAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useSwitchConnection.js
function useSwitchConnection(parameters = {}) {
  const config = useConfig(parameters);
  const options = switchConnectionMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    connectors: useConnections({ config }).map((connection) => connection.connector),
    switchAccount: mutation.mutate,
    switchAccountAsync: mutation.mutateAsync,
    switchConnection: mutation.mutate,
    switchConnectionAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useTransaction.js
function useTransaction(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getTransactionQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useTransactionConfirmations.js
function useTransactionConfirmations(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getTransactionConfirmationsQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useTransactionCount.js
function useTransactionCount(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getTransactionCountQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useTransactionReceipt.js
function useTransactionReceipt(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = getTransactionReceiptQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useVerifyMessage.js
function useVerifyMessage(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = verifyMessageQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useVerifyTypedData.js
function useVerifyTypedData(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = verifyTypedDataQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useWaitForCallsStatus.js
function useWaitForCallsStatus(parameters) {
  const config = useConfig(parameters);
  const { connector } = useConnection({ config });
  const options = waitForCallsStatusQueryOptions(config, {
    ...parameters,
    connector: parameters.connector ?? connector
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useWaitForTransactionReceipt.js
function useWaitForTransactionReceipt(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const options = waitForTransactionReceiptQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId
  });
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useWalletClient.js
var import_react15 = __toESM(require_react(), 1);
function useWalletClient(parameters = {}) {
  const config = useConfig(parameters);
  const chainId = useChainId({ config });
  const { address, connector } = useConnection({ config });
  const options = getWalletClientQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
    connector: parameters.connector ?? connector,
    query: parameters.query
  });
  const addressRef = (0, import_react15.useRef)(address);
  const queryClient = useQueryClient();
  (0, import_react15.useEffect)(() => {
    const previousAddress = addressRef.current;
    if (!address && previousAddress) {
      queryClient.removeQueries({ queryKey: options.queryKey });
      addressRef.current = void 0;
    } else if (address !== previousAddress) {
      queryClient.invalidateQueries({ queryKey: options.queryKey });
      addressRef.current = address;
    }
  }, [address, queryClient]);
  return useQuery2(options);
}

// node_modules/wagmi/dist/esm/hooks/useWatchAsset.js
function useWatchAsset(parameters = {}) {
  const config = useConfig(parameters);
  const options = watchAssetMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    watchAsset: mutation.mutate,
    watchAssetAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useWatchContractEvent.js
var import_react16 = __toESM(require_react(), 1);
function useWatchContractEvent(parameters = {}) {
  const { enabled = true, onLogs, config: _, ...rest } = parameters;
  const config = useConfig(parameters);
  const configChainId = useChainId({ config });
  const chainId = parameters.chainId ?? configChainId;
  const onLogsRef = (0, import_react16.useRef)(onLogs);
  const onErrorRef = (0, import_react16.useRef)(rest.onError);
  onLogsRef.current = onLogs;
  onErrorRef.current = rest.onError;
  const abiRef = (0, import_react16.useRef)(rest.abi);
  const addressRef = (0, import_react16.useRef)(rest.address);
  const argsRef = (0, import_react16.useRef)(rest.args);
  if (!abiRef.current || !deepEqual(abiRef.current, rest.abi))
    abiRef.current = rest.abi;
  if (!addressRef.current || !deepEqual(addressRef.current, rest.address))
    addressRef.current = rest.address;
  if (!argsRef.current || !deepEqual(argsRef.current, rest.args))
    argsRef.current = rest.args;
  (0, import_react16.useEffect)(() => {
    if (!enabled)
      return;
    if (!onLogsRef.current)
      return;
    return watchContractEvent(config, {
      ...rest,
      chainId,
      onLogs: (logs) => onLogsRef.current?.(logs),
      onError: (error) => onErrorRef.current?.(error)
    });
  }, [
    chainId,
    config,
    enabled,
    ///
    abiRef.current,
    addressRef.current,
    argsRef.current,
    rest.batch,
    rest.eventName,
    rest.fromBlock,
    rest.poll,
    rest.pollingInterval,
    rest.strict,
    rest.syncConnectedChain
  ]);
}

// node_modules/wagmi/dist/esm/hooks/useWatchPendingTransactions.js
var import_react17 = __toESM(require_react(), 1);
function useWatchPendingTransactions(parameters = {}) {
  const { enabled = true, onTransactions, config: _, ...rest } = parameters;
  const config = useConfig(parameters);
  const configChainId = useChainId({ config });
  const chainId = parameters.chainId ?? configChainId;
  const onTransactionsRef = (0, import_react17.useRef)(onTransactions);
  const onErrorRef = (0, import_react17.useRef)(rest.onError);
  onTransactionsRef.current = onTransactions;
  onErrorRef.current = rest.onError;
  (0, import_react17.useEffect)(() => {
    if (!enabled)
      return;
    if (!onTransactionsRef.current)
      return;
    return watchPendingTransactions(config, {
      ...rest,
      chainId,
      onTransactions: (transactions) => onTransactionsRef.current?.(transactions),
      onError: (error) => onErrorRef.current?.(error)
    });
  }, [
    chainId,
    config,
    enabled,
    ///
    rest.batch,
    rest.poll,
    rest.pollingInterval,
    rest.syncConnectedChain
  ]);
}

// node_modules/wagmi/dist/esm/hooks/useWriteContract.js
function useWriteContract(parameters = {}) {
  const config = useConfig(parameters);
  const options = writeContractMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    writeContract: mutation.mutate,
    writeContractAsync: mutation.mutateAsync
  };
}

// node_modules/wagmi/dist/esm/hooks/useWriteContractSync.js
function useWriteContractSync(parameters = {}) {
  const config = useConfig(parameters);
  const options = writeContractSyncMutationOptions(config, parameters);
  const mutation = useMutation(options);
  return {
    ...mutation,
    writeContractSync: mutation.mutate,
    writeContractSyncAsync: mutation.mutateAsync
  };
}
export {
  BaseError2 as BaseError,
  ChainNotConfiguredError,
  ConnectorAccountNotFoundError,
  ConnectorAlreadyConnectedError,
  ConnectorChainMismatchError,
  ConnectorNotFoundError,
  ConnectorUnavailableReconnectingError,
  Hydrate,
  ProviderNotFoundError,
  SwitchChainNotSupportedError,
  WagmiContext,
  WagmiProvider,
  WagmiProviderNotFoundError,
  cookieStorage,
  cookieToInitialState,
  createConfig,
  createConnector,
  createStorage,
  custom,
  deepEqual,
  deserialize,
  fallback2 as fallback,
  http,
  injected,
  mock,
  noopStorage,
  parseCookie,
  serialize,
  unstable_connector,
  useConnection as useAccount,
  useConnectionEffect as useAccountEffect,
  useBalance,
  useBlobBaseFee,
  useBlock,
  useBlockNumber,
  useBlockTransactionCount,
  useBytecode,
  useCall,
  useCallsStatus,
  useCapabilities,
  useChainId,
  useChains,
  useClient,
  useConfig,
  useConnect,
  useConnection,
  useConnectionEffect,
  useConnections,
  useConnectorClient,
  useConnectors,
  useContractEvents,
  useDeployContract,
  useDisconnect,
  useEnsAddress,
  useEnsAvatar,
  useEnsName,
  useEnsResolver,
  useEnsText,
  useEstimateFeesPerGas,
  useEstimateGas,
  useEstimateMaxPriorityFeePerGas,
  useFeeHistory,
  useGasPrice,
  useInfiniteReadContracts,
  usePrepareTransactionRequest,
  useProof,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useReconnect,
  useSendCalls,
  useSendCallsSync,
  useSendTransaction,
  useSendTransactionSync,
  useShowCallsStatus,
  useSignMessage,
  useSignTransaction,
  useSignTypedData,
  useSimulateContract,
  useStorageAt,
  useSwitchConnection as useSwitchAccount,
  useSwitchChain,
  useSwitchConnection,
  useTransaction,
  useTransactionConfirmations,
  useTransactionCount,
  useTransactionReceipt,
  useVerifyMessage,
  useVerifyTypedData,
  useWaitForCallsStatus,
  useWaitForTransactionReceipt,
  useWalletClient,
  useWatchAsset,
  useWatchBlockNumber,
  useWatchBlocks,
  useWatchContractEvent,
  useWatchPendingTransactions,
  useWriteContract,
  useWriteContractSync,
  version2 as version,
  webSocket
};
//# sourceMappingURL=wagmi.js.map
