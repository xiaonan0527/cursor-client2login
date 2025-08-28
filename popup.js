// Cursor Client2Login - 简化Popup页面脚本
console.log('🔍 Popup页面调试信息:', chrome.runtime.id);

// 简化的Toast通知系统
const SimpleToast = {
  show(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
};

// 状态管理
const SimpleState = {
  currentAccount: null,

  async loadCurrentStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getCurrentAccount' });
      this.currentAccount = response?.currentAccount;
      this.updateStatusDisplay();
    } catch (error) {
      console.error('加载当前状态失败:', error);
      this.updateStatusDisplay();
    }
  },

  updateStatusDisplay() {
    const statusElement = document.getElementById('currentStatus');
    if (!statusElement) return;

    const statusIcon = statusElement.querySelector('.status-icon');
    const statusTitle = statusElement.querySelector('.status-title');
    const statusEmail = statusElement.querySelector('.status-email');
    const statusUserid = statusElement.querySelector('.status-userid');
    
    if (this.currentAccount) {
      statusElement.className = 'current-status has-account';
      if (statusIcon) statusIcon.textContent = '✅';
      if (statusTitle) statusTitle.textContent = '当前账户';
      if (statusEmail) statusEmail.textContent = this.currentAccount.email;
      if (statusUserid) statusUserid.textContent = `ID: ${this.currentAccount.userid}`;
    } else {
      statusElement.className = 'current-status no-account';
      if (statusIcon) statusIcon.textContent = '👤';
      if (statusTitle) statusTitle.textContent = '当前账户';
      if (statusEmail) statusEmail.textContent = '未登录';
      if (statusUserid) statusUserid.textContent = '请先导入账户';
    }
  }
};

// 快速操作
const QuickActions = {
  openMainPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('main.html'),
      active: true
    });
  },

  async openDashboard() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'openDashboard' });
      if (response.success) {
        SimpleToast.show('Dashboard已打开', 'success');
      } else {
        SimpleToast.show('打开Dashboard失败: ' + response.error, 'error');
      }
    } catch (error) {
      SimpleToast.show('操作失败: ' + error.message, 'error');
    }
  },

  quickSwitch() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('main.html#accounts'),
      active: true
    });
  },

  async quickClear() {
    if (!confirm('确定要清空所有数据吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await chrome.storage.local.clear();
      await chrome.runtime.sendMessage({ action: 'clearCookie' });
      SimpleToast.show('数据已清空', 'success');
      SimpleState.loadCurrentStatus();
    } catch (error) {
      SimpleToast.show('清空数据失败: ' + error.message, 'error');
    }
  }
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 初始化Popup页面...');
  
  // 设置事件监听器
  document.getElementById('openMainPageBtn')?.addEventListener('click', QuickActions.openMainPage);
  document.getElementById('quickDashboardBtn')?.addEventListener('click', QuickActions.openDashboard);
  document.getElementById('quickSwitchBtn')?.addEventListener('click', QuickActions.quickSwitch);
  document.getElementById('quickClearBtn')?.addEventListener('click', QuickActions.quickClear);
  
  // 加载当前状态
  await SimpleState.loadCurrentStatus();
  
  console.log('✅ Popup页面初始化完成');
});
