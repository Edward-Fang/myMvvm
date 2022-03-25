const compileUtil = {
  getValue(expr, vm) {
    //  expr: person.name这种情况
    return expr.split(".").reduce((data, currentValue) => {
      // vm.$data作为 data 的初始值，currentValue是从数组第一个开始计算
      // 第一次执行 data[currentValue] 就是 vm.$data.msg
      // 第二次执行 data[currentValue] 就是 vm.$data.person
      // 第三次执行 data[currentValue] 就是 vm.$data.person.name
      return data[currentValue];
    }, vm.$data);
  },
  setValue(expr, vm, inputValue) {
    return expr.split(".").reduce((data, currentVal, index, arr) => {
      if (index == arr.length - 1) {
        data[currentVal] = inputValue;
      }
      return data[currentVal];
    }, vm.$data);
  },
  getContentValue(expr, vm) {
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => this.getValue(args[1], vm));
  },
  text(node, expr, vm) {
    // expr: msg
    let value;
    if (expr.indexOf("{{") !== -1) {
      // {{person.name}} -- {{person.age}}
      value = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        new Watcher(vm, args[1], () => this.updater.textUpdater(node, this.getContentValue(expr, vm)));
        return this.getValue(args[1], vm);
      });
    } else {
      value = this.getValue(expr, vm);
    }
    this.updater.textUpdater(node, value); // 用 . 取值，是个对象，要用 :
  },
  html(node, expr, vm) {
    const value = this.getValue(expr, vm);
    // 解析指令时不仅要绑定Watcher进行监听，还要更新界面
    // 5)更改数据
    new Watcher(vm, expr, (newValue) => this.updater.htmlUpdater(node, newValue));
    this.updater.htmlUpdater(node, value);
  },
  model(node, expr, vm) {
    const value = this.getValue(expr, vm);
    // 数据 ==> 视图
    new Watcher(vm, expr, (newValue) => {
      this.updater.modelUpdater(node, newValue);
    });

    // 视图 ==> 数据 ==> 视图
    node.addEventListener("input", (e) => {
      // 设置值
      this.setValue(expr, vm, e.target.value);
    });
    this.updater.modelUpdater(node, value);
  },
  on(node, expr, vm, eventName) {
    let fn = vm.$options.methods && vm.$options.methods[expr];
    node.addEventListener(eventName, fn.bind(vm), false); // false关闭冒泡
  },

  // 更新的函数
  updater: {
    textUpdater(node, value) {
      node.textContent = value;
    },
    htmlUpdater(node, value) {
      node.innerHTML = value;
    },
    modelUpdater(node, value) {
      node.value = value;
    },
  },
};

class Compile {
  // 构造函数
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    // 1.获取文档碎片对象，放入内存中会减少页面的回流和重绘
    const fragment = this.node2Fragment(this.el);
    // 2.编译模板
    this.compile(fragment);
    // 3.追加子元素到根元素
    this.el.appendChild(fragment);
  }

  // 文档碎片
  node2Fragment(el) {
    // 创建文档碎片
    const f = document.createDocumentFragment();
    let firstChild;
    // 赋值并判断child是否为空，即while(child)
    while ((firstChild = el.firstChild)) {
      // fragment把el.firstChild(el.children[0])抽离了出来，这个操作是move dom，el.children[0]被抽出，
      // 在下次while循环执行firstChild = el.firstChild时读取的是相对本次循环的el.children[1]以此达到循环转移dom的目的
      f.append(firstChild);
    }
    return f;
  }

  // 编译
  compile(fragment) {
    // 1.获取子节点
    const childNodes = fragment.childNodes;
    [...childNodes].forEach((child) => {
      // console.log(child);
      if (this.isElementNode(child)) {
        // 元素节点 编译
        // console.log('元素节点', child);
        this.compileElement(child);
      } else {
        // 文本节点 编译
        // console.log('文本节点', child);
        this.compileText(child);
      }
      if (child.childNodes && child.childNodes.length) {
        this.compile(child);
      }
    });
  }

  // 编译元素
  compileElement(node) {
    const attributes = node.attributes; // 获取属性
    [...attributes].forEach((attr) => {
      const { name, value } = attr;
      if (this.isDirective(name)) {
        // 是指令 v-text v-html v-model v-on:click
        const [, directive] = name.split("-"); // text html model on:click
        const [dirName, eventName] = directive.split(":"); // text html model on
        // 更新数据  数据驱动视图
        compileUtil[dirName](node, value, this.vm, eventName);
        // 删除指令标签上的属性
        node.removeAttribute("v-" + directive);
      } else if (this.isEventName(name)) {
        // @click="handlerClick"
        const [, eventName] = name.split("@");
        compileUtil["on"](node, value, this.vm, eventName);
      }
    });
  }

  // 编译文本
  compileText(node) {
    // 利用正则匹配
    const content = node.textContent;
    if (/\{\{(.+?)\}\}/.test(content)) {
      compileUtil["text"](node, content, this.vm);
    }
  }

  // 判断是否是元素节点
  isElementNode(node) {
    // nodeType 属性返回以数字值返回指定节点的节点类型。节点是元素节点返回 1。节点是属性节点将返回 2。
    return node.nodeType === 1;
  }

  // 判断是否以 'v-' 开头
  isDirective(attrName) {
    return attrName.startsWith("v-");
  }

  // 判断是否以 '@' 开头
  isEventName(attrName) {
    return attrName.startsWith("@");
  }
}

class MVue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    this.$options = options; // 两个属性  {el: '#app', data: {…}}
    if (this.$el) {
      // 1.实现一个数据观察者
      new Observer(this.$data);
      // 2.实现一个指令解析器
      new Compile(this.$el, this); // 这个this指的是整个MVue  MVue {$el: '#app', $data: {…}, $options: {…}}
      // 设置代理
      this.proxyData(this.$data);
    }
  }
  proxyData(data) {
    for (const key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key];
        },
        set(newValue) {
          data[key] = newValue;
        },
      });
    }
  }
}
