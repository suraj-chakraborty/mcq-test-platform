import { viewport } from '../layout';
import fs from 'fs';
import path from 'path';

describe('Responsive Design & Mobile Viewport Audit (320px - 2560px)', () => {
  describe('Viewport Configuration', () => {
    it('exports a compliant Next.js Viewport configuration in root layout', () => {
      expect(viewport).toBeDefined();
      expect(viewport.width).toBe('device-width');
      expect(viewport.initialScale).toBe(1);
      expect(viewport.maximumScale).toBe(5);
    });

    it('ensures root layout body has overflow-x-hidden and min-w-[320px]', () => {
      const layoutFile = fs.readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf-8');
      expect(layoutFile).toContain('min-w-[320px]');
      expect(layoutFile).toContain('overflow-x-hidden');
    });
  });

  describe('Modal & Dialog Viewport Containment', () => {
    it('ensures DialogContent defines max-h-[90vh] and overflow-y-auto to prevent mobile screen clipping', () => {
      const dialogFile = fs.readFileSync(path.join(process.cwd(), 'src/components/ui/dialog.tsx'), 'utf-8');
      expect(dialogFile).toContain('max-h-[90vh]');
      expect(dialogFile).toContain('overflow-y-auto');
      expect(dialogFile).toContain('w-[calc(100%-2rem)]');
    });

    it('ensures AlertDialogContent defines max-h-[90vh] and overflow-y-auto to prevent mobile screen clipping', () => {
      const alertDialogFile = fs.readFileSync(path.join(process.cwd(), 'src/components/ui/alert-dialog.tsx'), 'utf-8');
      expect(alertDialogFile).toContain('max-h-[90vh]');
      expect(alertDialogFile).toContain('overflow-y-auto');
      expect(alertDialogFile).toContain('w-[calc(100%-2rem)]');
    });

    it('ensures TestCreationProgressModal and OralExam modals are bounded by max-h-[90vh] and overflow-y-auto', () => {
      const progressModalFile = fs.readFileSync(path.join(process.cwd(), 'src/app/components/TestCreationProgressModal.tsx'), 'utf-8');
      expect(progressModalFile).toContain('max-h-[90vh]');
      expect(progressModalFile).toContain('overflow-y-auto');

      const oralExamFile = fs.readFileSync(path.join(process.cwd(), 'src/app/components/OralExam.tsx'), 'utf-8');
      expect(oralExamFile).toContain('max-h-[90vh]');
      expect(oralExamFile).toContain('overflow-y-auto');
    });
  });

  describe('Mobile Navigation & Drawer Integration', () => {
    it('ensures dashboard has slide-over mobile drawer state and triggers', () => {
      const dashboardFile = fs.readFileSync(path.join(process.cwd(), 'src/app/dashboard/page.tsx'), 'utf-8');
      expect(dashboardFile).toContain('isMobileDrawerOpen');
      expect(dashboardFile).toContain('setIsMobileDrawerOpen');
      expect(dashboardFile).toContain('activeTab');
    });

    it('ensures Navbar has responsive padding for 320px screen width', () => {
      const navbarFile = fs.readFileSync(path.join(process.cwd(), 'src/app/components/Navbar.tsx'), 'utf-8');
      expect(navbarFile).toContain('px-3 sm:px-6 lg:px-8');
    });
  });

  describe('Ultrawide (2560px) Container Containment', () => {
    it('ensures descriptive writing page has max-width containment rather than unrestricted container', () => {
      const descriptiveFile = fs.readFileSync(path.join(process.cwd(), 'src/app/descriptive/page.tsx'), 'utf-8');
      expect(descriptiveFile).toContain('max-w-screen-xl mx-auto');
      expect(descriptiveFile).not.toContain('container mx-auto px-4 py-8');
    });
  });
});
