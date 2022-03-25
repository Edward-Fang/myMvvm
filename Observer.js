class Watcher {
  constructor(vm, expr, cb) {
    // cb 是new Watcher时创建的
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    // 先获取旧值
    this.oldValue = this.getValue();
  }

  getValue() {
    Dep.target = this; // 把对应的Watcher绑定到Dep.target上
    const oldValue = compileUtil.getValue(this.expr, this.vm);
    Dep.target = null; // 用完必须销毁，不然Watcher会重复
    return oldValue;
  }

  update() {
    // 4)拿到新值，如果不一样执行回调函数 cb
    const newValue = compileUtil.getValue(this.expr, this.vm);
    if (newValue !== this.oldValue) {
      this.cb(newValue);
    }
  }
}

class Dep {
  constructor() {
    this.subs = [];
  }

  // 1.收集观察者
  addSub(watcher) {
    this.subs.push(watcher);
  }

  // 2.通知观察者更新
  notify() {
    // 3)subs里有所有观察者，拿到对应的观察者，执行update函数
    this.subs.forEach((watcher) => watcher.update());
  }
}

class Observer {
  constructor(data) {
    this.observer(data);
  }
  observer(data) {
    // 可能有多层
    if (data && typeof data === "object") {
      Object.keys(data).forEach((key) => {
        this.defineReactive(data, key, data[key]);
      });
    }
  }
  defineReactive(data, key, value) {
    // 递归遍历
    this.observer(value);
    const dep = new Dep();
    // 劫持并监听所有的属性
    Object.defineProperty(data, key, {
      enumerable: true,
      configurable: false,
      get() {
        // 初始化
        // 订阅数据变化时，往订阅收集器(Dep)中添加观察者，这时 Observer 与 Dep 相关联
        Dep.target && dep.addSub(Dep.target);
        return value;
      },
      set: (newValue) => {
        // 1)当修改数据时，先来到set这里进行监听，发现新的值就更改
        // 2)用Dep通知，执行notify
        this.observer(newValue);
        if (newValue !== value) {
          value = newValue;
        }

        // 告诉Dep通知变化
        dep.notify();
      },
    });
  }
}
