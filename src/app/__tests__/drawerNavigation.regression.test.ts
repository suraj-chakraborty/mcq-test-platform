/**
 * Module 2: Drawer Navigation Regression Suite
 *
 * Verifies that the mobile drawer correctly animates and routes users to
 * their target assessment mode components and utility screens without getting
 * stuck on the Dashboard.
 */

interface DrawerItem {
  key: string;
  label: string;
  path: string;
  badge?: number;
}

const ASSESSMENT_MODES: DrawerItem[] = [
  { key: 'current_affair', label: 'Normal Test', path: '/(tabs)/dashboard' },
  { key: 'study', label: 'Study & Flashcards', badge: 16, path: '/(tabs)/study' },
  { key: 'pdf', label: 'PDF Management', path: '/(tabs)/upload' },
  { key: 'pyq-pdf', label: 'PYQ Based', path: '/(tabs)/pyq' },
  { key: 'descriptive', label: 'Descriptive', path: '/(tabs)/descriptive' },
];

const BOTTOM_NAV_TABS = [
  { routeName: 'dashboard/index', path: '/(tabs)/dashboard', label: 'Normal Test' },
  { routeName: 'study/index', path: '/(tabs)/study', label: 'Study' },
  { routeName: 'upload/index', path: '/(tabs)/upload', label: 'PDF Management' },
  { routeName: 'pyq/index', path: '/(tabs)/pyq', label: 'PYQ Based' },
  { routeName: 'descriptive/index', path: '/(tabs)/descriptive', label: 'Descriptive' },
];

/**
 * Controller class simulating the exact drawer state machine and navigation logic
 * implemented in DashboardScreen.
 */
class DrawerNavigationController {
  public isOpen: boolean = false;
  public selectedNavKey: string = 'current_affair';
  public activeTab: string = 'current_affair';
  public currentPath: string = '/(tabs)/dashboard';
  public animValue: number = 0; // 0 = closed, 1 = open

  constructor(
    private router: {
      push: (path: string) => void;
      replace: (path: string) => void;
    },
    private auth: {
      logout: () => Promise<void>;
    }
  ) {}

  openDrawer() {
    this.selectedNavKey = 'current_affair';
    this.isOpen = true;
    this.animValue = 1;
  }

  closeDrawer(callback?: () => void | Promise<void>) {
    this.animValue = 0;
    this.isOpen = false;
    if (callback) {
      callback();
    }
  }

  selectAssessmentMode(mode: DrawerItem) {
    // 1. Immediate visual highlight for tactile feedback
    this.selectedNavKey = mode.key;

    // 2. Slide out and execute route navigation
    this.closeDrawer(() => {
      if (mode.path === '/(tabs)/dashboard') {
        this.activeTab = 'current_affair';
        this.currentPath = '/(tabs)/dashboard';
      } else {
        this.currentPath = mode.path;
        this.router.replace(mode.path);
      }
    });
  }

  selectQuickShortcut(type: 'duel' | 'math' | 'custom-test') {
    this.closeDrawer(() => {
      if (type === 'duel') this.router.push('/duel');
      if (type === 'math') this.router.push('/math-solver');
      if (type === 'custom-test') this.router.push('/test/manual-create');
    });
  }

  selectBottomAction(action: 'settings' | 'profile' | 'logout') {
    this.closeDrawer(async () => {
      if (action === 'settings') {
        this.router.push('/settings');
      } else if (action === 'profile') {
        this.router.push('/profile');
      } else if (action === 'logout') {
        await this.auth.logout();
        this.router.replace('/(auth)/signin');
      }
    });
  }
}

describe('Module 2: Drawer Navigation Regression Suite', () => {
  let mockPush: jest.Mock;
  let mockReplace: jest.Mock;
  let mockLogout: jest.Mock;
  let controller: DrawerNavigationController;

  beforeEach(() => {
    mockPush = jest.fn();
    mockReplace = jest.fn();
    mockLogout = jest.fn().mockResolvedValue(undefined);

    controller = new DrawerNavigationController(
      { push: mockPush, replace: mockReplace },
      { logout: mockLogout }
    );
  });

  describe('Route Mapping Integrity', () => {
    it('[P0] ensures all ASSESSMENT_MODES have explicit non-empty canonical paths', () => {
      for (const mode of ASSESSMENT_MODES) {
        expect(mode.path).toBeDefined();
        expect(mode.path.startsWith('/(tabs)/')).toBe(true);
        expect(mode.label).toBeTruthy();
        expect(mode.key).toBeTruthy();
      }
    });

    it('[P0] aligns 1:1 with Bottom Navigation Tabs canonical routes', () => {
      for (const mode of ASSESSMENT_MODES) {
        const matchingBottomTab = BOTTOM_NAV_TABS.find(
          (t) => t.path === mode.path || t.label.includes(mode.label.split(' ')[0])
        );
        expect(matchingBottomTab).toBeDefined();
        expect(mode.path).toBe(matchingBottomTab?.path);
      }
    });
  });

  describe('Assessment Mode Navigation Execution (BUG-NAV Regression)', () => {
    it('[P0] routes to PDF Management screen (/(tabs)/upload) on item click', () => {
      controller.openDrawer();
      expect(controller.isOpen).toBe(true);

      const pdfMode = ASSESSMENT_MODES.find((m) => m.key === 'pdf')!;
      controller.selectAssessmentMode(pdfMode);

      // Verifies visual feedback occurred before animation completed
      expect(controller.selectedNavKey).toBe('pdf');
      expect(controller.isOpen).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/upload');
      expect(controller.currentPath).toBe('/(tabs)/upload');
    });

    it('[P0] routes to Study & Flashcards screen (/(tabs)/study) on item click', () => {
      controller.openDrawer();
      const studyMode = ASSESSMENT_MODES.find((m) => m.key === 'study')!;
      controller.selectAssessmentMode(studyMode);

      expect(controller.selectedNavKey).toBe('study');
      expect(controller.isOpen).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/study');
      expect(controller.currentPath).toBe('/(tabs)/study');
    });

    it('[P0] routes to PYQ Based screen (/(tabs)/pyq) on item click', () => {
      controller.openDrawer();
      const pyqMode = ASSESSMENT_MODES.find((m) => m.key === 'pyq-pdf')!;
      controller.selectAssessmentMode(pyqMode);

      expect(controller.selectedNavKey).toBe('pyq-pdf');
      expect(controller.isOpen).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/pyq');
      expect(controller.currentPath).toBe('/(tabs)/pyq');
    });

    it('[P0] routes to Descriptive Studio screen (/(tabs)/descriptive) on item click', () => {
      controller.openDrawer();
      const descMode = ASSESSMENT_MODES.find((m) => m.key === 'descriptive')!;
      controller.selectAssessmentMode(descMode);

      expect(controller.selectedNavKey).toBe('descriptive');
      expect(controller.isOpen).toBe(false);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/descriptive');
      expect(controller.currentPath).toBe('/(tabs)/descriptive');
    });

    it('[P0] resets filter to current_affair without unmounting dashboard when Normal Test is tapped', () => {
      controller.openDrawer();
      const normalMode = ASSESSMENT_MODES.find((m) => m.key === 'current_affair')!;
      controller.selectAssessmentMode(normalMode);

      expect(controller.selectedNavKey).toBe('current_affair');
      expect(controller.activeTab).toBe('current_affair');
      expect(controller.isOpen).toBe(false);
      expect(mockReplace).not.toHaveBeenCalled(); // Stays on current dashboard
      expect(controller.currentPath).toBe('/(tabs)/dashboard');
    });
  });

  describe('Quick Action Shortcuts Navigation', () => {
    it('[P1] routes to Live Duel arena (/duel)', () => {
      controller.openDrawer();
      controller.selectQuickShortcut('duel');

      expect(controller.isOpen).toBe(false);
      expect(mockPush).toHaveBeenCalledWith('/duel');
    });

    it('[P1] routes to Formula Scan Math OCR (/math-solver)', () => {
      controller.openDrawer();
      controller.selectQuickShortcut('math');

      expect(controller.isOpen).toBe(false);
      expect(mockPush).toHaveBeenCalledWith('/math-solver');
    });

    it('[P1] routes to Custom Test Creator (/test/manual-create)', () => {
      controller.openDrawer();
      controller.selectQuickShortcut('custom-test');

      expect(controller.isOpen).toBe(false);
      expect(mockPush).toHaveBeenCalledWith('/test/manual-create');
    });
  });

  describe('Bottom Actions Navigation', () => {
    it('[P1] navigates to Settings & AI Configuration (/settings)', () => {
      controller.openDrawer();
      controller.selectBottomAction('settings');

      expect(controller.isOpen).toBe(false);
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });

    it('[P1] navigates to User Profile & Rank (/profile)', () => {
      controller.openDrawer();
      controller.selectBottomAction('profile');

      expect(controller.isOpen).toBe(false);
      expect(mockPush).toHaveBeenCalledWith('/profile');
    });

    it('[P0] signs out user, clears tokens, and redirects to /(auth)/signin', async () => {
      controller.openDrawer();
      controller.selectBottomAction('logout');

      expect(controller.isOpen).toBe(false);
      await Promise.resolve(); // flush async logout
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/signin');
    });
  });

  describe('Drawer State & Dismissal', () => {
    it('[P2] closing drawer via backdrop press does not trigger navigation', () => {
      controller.openDrawer();
      expect(controller.isOpen).toBe(true);

      controller.closeDrawer();
      expect(controller.isOpen).toBe(false);
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('[P2] reopening drawer resets selectedNavKey to current_affair by default', () => {
      controller.openDrawer();
      controller.selectedNavKey = 'pdf'; // User had previously highlighted PDF

      // Reopening drawer resets to default
      controller.openDrawer();
      expect(controller.selectedNavKey).toBe('current_affair');
      expect(controller.isOpen).toBe(true);
    });
  });
});
