import pick from 'lodash/pick';
import { SetupContext } from '@vue/composition-api';
import TreeStore from '../../_common/js/tree/tree-store';
import {
  TreeProps,
  TypeValueMode,
  TypeEventState,
  TypeTreeNodeModel,
  TypeTreeNode,
  TypeTNodeValue,
} from '../interface';

export default function useTreeStore(props: TreeProps, context: SetupContext) {
  const {
    actived, value, valueMode, filter, keys,
  } = props;

  const store: TreeStore = new TreeStore({
    valueMode: valueMode as TypeValueMode,
    filter,
  });

  // 同步 Store 选项
  const updateStoreConfig = () => {
    // 统一更新选项，然后在 store 统一识别属性更新
    // 注意: keys 属性比较特殊，不应该在实例化之后再次变更
    const storeProps = pick(props, [
      'expandAll',
      'expandLevel',
      'expandMutex',
      'expandParent',
      'activable',
      'activeMultiple',
      'disabled',
      'checkable',
      'draggable',
      'checkStrictly',
      'load',
      'lazy',
      'valueMode',
      'filter',
      'allowFoldNodeOnFilter',
    ]);
    store.setConfig(storeProps);
  };

  const updateExpanded = () => {
    const { expanded, expandParent } = props;
    if (!Array.isArray(expanded)) return;
    // 初始化展开状态
    // 校验是否自动展开父节点
    const expandedMap = new Map();
    expanded.forEach((val) => {
      expandedMap.set(val, true);
      if (expandParent) {
        const node = store.getNode(val);
        if (node) {
          node
            .getModel()
            .getParents()
            .forEach((tn: TypeTreeNodeModel) => {
              expandedMap.set(tn.value, true);
            });
        }
      }
    });
    const expandedArr = Array.from(expandedMap.keys());
    store.setExpanded(expandedArr);
  };

  let filterChanged = false;
  let prevExpanded: null | TypeTNodeValue[] = null;

  // store 的 update 方法触发后，可以拿到搜索命中节点的路径节点
  // 所以在 update 之后检查，如果之前 filter 有变更，则检查路径节点是否需要展开
  // 如果 filter 属性被清空，则重置为开启搜索之前的结果
  const expandFilterPath = () => {
    if (!props.allowFoldNodeOnFilter) return;
    if (!filterChanged) return;
    // 确保 filter 属性未变更时，不会重复检查展开状态
    filterChanged = false;

    if (props.filter) {
      if (!prevExpanded) {
        // 缓存之前的展开状态
        prevExpanded = store.getExpanded();
      }

      // 展开搜索命中节点的路径节点
      const pathValues: TypeTNodeValue[] = [];
      const allNodes: TypeTreeNode[] = store.getNodes();
      allNodes.forEach((node: TypeTreeNode) => {
        if (node.vmIsLocked) {
          pathValues.push(node.value);
        }
      });
      store.setExpanded(pathValues);
    } else if (prevExpanded) {
      // filter 属性置空，该还原之前的展开状态了
      store.replaceExpanded(prevExpanded);
      prevExpanded = null;
    }
  };

  // 这个方法监听 filter 属性，仅在 allowFoldNodeOnFilter 属性为 true 时生效
  // 仅在 filter 属性发生变更时开启检查开关，避免其他操作也触发展开状态的重置
  const checkFilterExpand = (newFilter: null | Function, previousFilter: null | Function) => {
    if (!props.allowFoldNodeOnFilter) return;
    filterChanged = newFilter !== previousFilter;
  };

  const handleLoad = (info: TypeEventState) => {
    const { node } = info;
    const evtCtx = {
      node: node.getModel(),
    };
    const { value, expanded, actived } = props;
    if (value && value.length > 0) {
      store.replaceChecked(value);
    }
    if (expanded && expanded.length > 0) {
      store.replaceExpanded(expanded);
    }
    if (actived && actived.length > 0) {
      store.replaceActived(actived);
    }
    if (props?.onLoad) {
      props?.onLoad(evtCtx);
    }
    context.emit('load', evtCtx);
  };

  const rebuild = (list: TreeProps['data']) => {
    const { value, actived } = props;
    store.reload(list || []);
    // 初始化选中状态
    if (Array.isArray(value)) {
      store.setChecked(value);
    }
    // 更新展开状态
    updateExpanded();
    // 初始化激活状态
    if (Array.isArray(actived)) {
      store.setActived(actived);
    }
    // 刷新节点状态
    store.refreshState();
  };

  // keys 属性比较特殊，不应该在实例化之后再次变更
  store.setConfig({
    keys,
  });
  updateStoreConfig();
  store.append(props.data || []);

  // 刷新节点，必须在配置选中之前执行
  // 这样选中态联动判断才能找到父节点
  store.refreshNodes();

  // 初始化选中状态
  if (Array.isArray(value)) {
    store.setChecked(value);
  }

  // 更新节点展开状态
  updateExpanded();

  // 初始化激活状态
  if (Array.isArray(actived)) {
    store.setActived(actived);
  }

  store.emitter.on('load', handleLoad);
  store.emitter.on('update', expandFilterPath);

  return {
    store,
    rebuild,
    updateStoreConfig,
    updateExpanded,
    checkFilterExpand,
    expandFilterPath,
  };
}
