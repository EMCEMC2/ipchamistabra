from playwright.sync_api import sync_playwright
import time
import json

def capture_dashboard_screenshots():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})

        # Enable console logging to catch any errors
        console_messages = []
        page.on('console', lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))

        try:
            print("Navigating to http://localhost:3002...")
            page.goto('http://localhost:3002', wait_until='networkidle', timeout=30000)

            # Wait a bit more for any dynamic content
            page.wait_for_timeout(2000)

            # Capture main dashboard view
            print("Capturing main dashboard (TERMINAL view)...")
            page.screenshot(path='C:\\Users\\Maria\\ipcha-mistabra-intel\\screenshots\\01_terminal_view.png', full_page=True)

            # Get page structure for analysis
            print("Analyzing page structure...")

            # Get all navigation buttons/tabs
            nav_elements = page.locator('button, [role="tab"], nav a').all()
            nav_texts = [elem.inner_text() for elem in nav_elements if elem.is_visible()]
            print(f"Found navigation elements: {nav_texts}")

            # Try to identify and click each view
            views = ['SWARM', 'ML CORTEX', 'BACKTEST', 'JOURNAL']

            for view_name in views:
                try:
                    print(f"\nAttempting to navigate to {view_name} view...")

                    # Try multiple selector strategies
                    selectors = [
                        f"button:has-text('{view_name}')",
                        f"[role='tab']:has-text('{view_name}')",
                        f"text={view_name}",
                        f"button >> text={view_name}",
                        f"div:has-text('{view_name}')"
                    ]

                    clicked = False
                    for selector in selectors:
                        try:
                            element = page.locator(selector).first
                            if element.is_visible():
                                element.click()
                                clicked = True
                                print(f"Clicked {view_name} using selector: {selector}")
                                break
                        except Exception as e:
                            continue

                    if clicked:
                        # Wait for view to load
                        page.wait_for_timeout(2000)

                        # Capture screenshot
                        filename = f"C:\\Users\\Maria\\ipcha-mistabra-intel\\screenshots\\{views.index(view_name) + 2:02d}_{view_name.lower().replace(' ', '_')}_view.png"
                        page.screenshot(path=filename, full_page=True)
                        print(f"Screenshot saved: {filename}")
                    else:
                        print(f"Could not find clickable element for {view_name}")

                except Exception as e:
                    print(f"Error capturing {view_name} view: {str(e)}")

            # Capture detailed UI analysis
            print("\nAnalyzing UI elements...")

            ui_analysis = {
                'url': page.url,
                'title': page.title(),
                'viewport': page.viewport_size,
                'colors': [],
                'typography': [],
                'layout_info': {}
            }

            # Get computed styles of main elements
            try:
                # Get body styles
                body_styles = page.evaluate("""() => {
                    const body = document.body;
                    const styles = window.getComputedStyle(body);
                    return {
                        backgroundColor: styles.backgroundColor,
                        color: styles.color,
                        fontFamily: styles.fontFamily,
                        fontSize: styles.fontSize
                    };
                }""")
                ui_analysis['body_styles'] = body_styles

                # Get all unique colors used
                colors = page.evaluate("""() => {
                    const elements = document.querySelectorAll('*');
                    const colors = new Set();
                    elements.forEach(el => {
                        const styles = window.getComputedStyle(el);
                        colors.add(styles.backgroundColor);
                        colors.add(styles.color);
                        colors.add(styles.borderColor);
                    });
                    return Array.from(colors).filter(c => c && c !== 'rgba(0, 0, 0, 0)');
                }""")
                ui_analysis['colors'] = colors[:20]  # Limit to top 20

                # Get typography info
                typography = page.evaluate("""() => {
                    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
                    const fonts = new Set();
                    const sizes = new Set();

                    headings.forEach(h => {
                        const styles = window.getComputedStyle(h);
                        fonts.add(styles.fontFamily);
                        sizes.add(h.tagName + ': ' + styles.fontSize);
                    });

                    return {
                        fonts: Array.from(fonts),
                        sizes: Array.from(sizes)
                    };
                }""")
                ui_analysis['typography'] = typography

                # Get main layout structure
                layout = page.evaluate("""() => {
                    const main = document.querySelector('main, [role="main"], .main, #main');
                    if (main) {
                        const styles = window.getComputedStyle(main);
                        return {
                            display: styles.display,
                            flexDirection: styles.flexDirection,
                            gridTemplateColumns: styles.gridTemplateColumns,
                            padding: styles.padding,
                            gap: styles.gap
                        };
                    }
                    return null;
                }""")
                ui_analysis['layout_info'] = layout

            except Exception as e:
                print(f"Error analyzing styles: {str(e)}")

            # Save analysis to JSON
            with open('C:\\Users\\Maria\\ipcha-mistabra-intel\\screenshots\\ui_analysis.json', 'w') as f:
                json.dump(ui_analysis, f, indent=2)

            print("\nUI Analysis saved to ui_analysis.json")

            # Print console messages if any
            if console_messages:
                print("\nConsole messages:")
                for msg in console_messages:
                    print(f"  {msg}")

        except Exception as e:
            print(f"Error during automation: {str(e)}")
            # Take error screenshot
            page.screenshot(path='C:\\Users\\Maria\\ipcha-mistabra-intel\\screenshots\\error_screenshot.png', full_page=True)

        finally:
            browser.close()
            print("\nBrowser closed. Screenshot capture complete.")

if __name__ == '__main__':
    capture_dashboard_screenshots()
