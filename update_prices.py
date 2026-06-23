import os
import requests
from bs4 import BeautifulSoup
import re
import json
import urllib3
from datetime import datetime

# Disable SSL warnings for Two Brothers certificate issue
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Config files
HTML_FILE = os.path.join(os.path.dirname(__file__), "index.html")
JSON_FILE = os.path.join(os.path.dirname(__file__), "prices.json")

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
}

products = {
    'anveshan': {
        'groundnut': 'https://www.anveshan.farm/products/wood-pressed-groundnut-oil',
        'mustard': 'https://www.anveshan.farm/products/wood-pressed-mustard-oil',
        'coconut': 'https://www.anveshan.farm/products/wood-pressed-coconut-oil',
        'sesame': 'https://www.anveshan.farm/products/wood-pressed-black-sesame-oil',
        'sunflower': 'https://www.anveshan.farm/products/sunflower-oil'
    },
    'gramiyaa': {
        'groundnut': 'https://gramiyaa.com/products/oils-wood-cold-pressed-groundnut-oil',
        'mustard': 'https://gramiyaa.com/products/oils-wood-cold-pressed-mustard-oil',
        'coconut': 'https://gramiyaa.com/products/oils-wood-cold-pressed-coconut-oil',
        'sesame': 'https://gramiyaa.com/products/oils-wood-cold-pressed-sesame-oil'
    },
    'twobrothers': {
        'groundnut': 'https://twobrothersindiashop.com/products/wood-pressed-organic-groundnut-peanut-oil-1litre-bottle',
        'mustard': 'https://twobrothersindiashop.com/products/black-mustard-oil',
        'coconut': 'https://twobrothersindiashop.com/products/coconut-oil-wood-pressed-unrefined',
        'sunflower': 'https://twobrothersindiashop.com/products/sunflower-oil'
    }
}

def parse_shopify_variants(html):
    # Search for Shopify var meta = {...};
    match = re.search(r'var\s+meta\s*=\s*({.*?});', html)
    if match:
        try:
            meta_data = json.loads(match.group(1))
            return meta_data.get('product', {}).get('variants', [])
        except Exception as e:
            print("  Error loading var meta JSON:", e)
    return None

def clean_variant_title(title):
    t = title.lower()
    if '500ml' in t or '500 ml' in t:
        return '500ml'
    elif '5 l' in t or '5l' in t or '5 ltr' in t or '5ltr' in t or '5litre' in t or '5 litre' in t:
        if 'tin' in t:
            return '5L Tin'
        return '5L Pack'
    elif '2 l' in t or '2l' in t or '2 ltr' in t or '2ltr' in t or '2litre' in t or '2 litre' in t:
        if 'tin' in t:
            return '2L Tin'
        return '2L Bottle'
    elif '250ml' in t or '250 ml' in t:
        return '250ml'
    elif '15 l' in t or '15l' in t or '15 ltr' in t or '15ltr' in t or '15litre' in t or '15 litre' in t:
        return '15L Tin'
    return title

def run_scraper():
    print("Starting Cold Pressed Oil Price Scraper...")
    scraped_data = {}
    
    for brand, oils in products.items():
        scraped_data[brand] = {}
        print(f"\n--- Scraping {brand.upper()} ---")
        for oil_type, url in oils.items():
            print(f"Fetching {oil_type} oil from {url}...")
            try:
                r = requests.get(url, headers=headers, verify=False, timeout=15)
                if r.status_code == 200:
                    variants = parse_shopify_variants(r.text)
                    if variants:
                        oil_info = {
                            'url': url,
                            'scraped_at': datetime.now().isoformat(),
                            'price_1l': None,
                            'variants': []
                        }
                        
                        # Process 1L variant first
                        primary_variant = None
                        if len(variants) == 1:
                            primary_variant = variants[0]
                        else:
                            # Search for 1L/1000ml variant
                            for v in variants:
                                vt = (v.get('public_title') or v.get('name') or '').lower()
                                if '1l' in vt or '1 l' in vt or '1litre' in vt or '1 litre' in vt or '1000ml' in vt or '1000 ml' in vt:
                                    if not any(x in vt for x in ['2 x', '3 x', '4 x', '5 x', '2x', '3x', '4x', '5x', 'pack of', 'combo']):
                                        primary_variant = v
                                        break
                            if not primary_variant:
                                # Fallback to default title
                                for v in variants:
                                    vt = (v.get('public_title') or v.get('name') or '').lower()
                                    if 'default' in vt:
                                        primary_variant = v
                                        break
                            if not primary_variant:
                                # Fallback to first variant
                                primary_variant = variants[0]
                        
                        oil_info['price_1l'] = primary_variant['price'] / 100
                        oil_info['available'] = primary_variant.get('available', True)
                        oil_info['title'] = primary_variant.get('public_title') or primary_variant.get('name')
                        
                        # Process other variants for the card details
                        for v in variants:
                            if v['id'] != primary_variant['id']:
                                v_title = v.get('public_title') or v.get('name')
                                oil_info['variants'].append({
                                    'title': clean_variant_title(v_title),
                                    'price': v['price'] / 100,
                                    'available': v.get('available', True)
                                })
                                
                        print(f"  Success: 1L price = Rs. {oil_info['price_1l']} (status: {'In stock' if oil_info['available'] else 'Out of stock'})")
                        scraped_data[brand][oil_type] = oil_info
                    else:
                        print("  Failed: Could not extract shopify variants from page HTML")
                else:
                    print(f"  Failed: HTTP status code {r.status_code}")
            except Exception as e:
                print(f"  Error: {e}")
                
    # Save scraped results to prices.json
    with open(JSON_FILE, 'w') as f:
        json.dump(scraped_data, f, indent=2)
    print(f"\nSaved scraped results to {JSON_FILE}")
    
    # Update index.html
    update_html(scraped_data)

def update_html(data):
    if not os.path.exists(HTML_FILE):
        print(f"Error: {HTML_FILE} not found. Cannot update dashboard.")
        return
        
    print(f"\nUpdating dashboard HTML file: {HTML_FILE}...")
    with open(HTML_FILE, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'html.parser')
        
    brands = ['anveshan', 'gramiyaa', 'twobrothers']
    oil_types = ['groundnut', 'mustard', 'coconut', 'sesame', 'sunflower']
    brand_titles = {
        'anveshan': 'Anveshan',
        'gramiyaa': 'Gramiyaa',
        'twobrothers': 'Two Brothers'
    }
    
    # 1. Update Price Cards
    print("Updating individual price cards...")
    for oil_type in oil_types:
        for brand in brands:
            card_id = f"{oil_type}-{brand}"
            card_div = soup.find('div', id=card_id)
            if not card_div:
                continue
                
            brand_data = data.get(brand, {}).get(oil_type)
            
            # Remove previous states
            card_div.attrs['class'] = [c for c in card_div.attrs.get('class', []) if c not in ['unavailable', 'best-price']]
            badge = card_div.find('div', class_='best-badge')
            if badge:
                badge.decompose()
                
            if not brand_data or brand_data.get('price_1l') is None:
                # Mark unavailable
                card_div.attrs['class'].append('unavailable')
                price_display = card_div.find('div', class_='price-display')
                if price_display:
                    price_display.clear()
                    price_display.append(soup.new_tag('span', attrs={'class': 'price-value unavailable-text'}))
                    price_display.find('span').string = 'Not Listed'
                    
                price_details = card_div.find('div', class_='price-details')
                if price_details:
                    price_details.clear()
                    row = soup.new_tag('div', attrs={'class': 'detail-row'})
                    span = soup.new_tag('span')
                    span.string = 'Check website for availability'
                    row.append(span)
                    price_details.append(row)
            else:
                # Update price
                price_1l = brand_data['price_1l']
                price_display = card_div.find('div', class_='price-display')
                if price_display:
                    price_display.clear()
                    
                    curr_span = soup.new_tag('span', attrs={'class': 'currency'})
                    curr_span.string = '₹'
                    price_display.append(curr_span)
                    price_display.append("\n                        ")
                    
                    val_span = soup.new_tag('span', attrs={'class': 'price-value'})
                    # format with comma if large number
                    val_span.string = f"{price_1l:,.0f}" if price_1l.is_integer() else f"{price_1l:,.2f}"
                    price_display.append(val_span)
                    price_display.append("\n                        ")
                    
                    unit_span = soup.new_tag('span', attrs={'class': 'price-unit'})
                    unit_span.string = '/ 1L'
                    price_display.append(unit_span)
                    price_display.append("\n                    ")
                    
                # Update details rows (other variants)
                price_details = card_div.find('div', class_='price-details')
                if price_details:
                    price_details.clear()
                    
                    variants = brand_data.get('variants', [])
                    # Sort variants by price so they display logically
                    variants = sorted(variants, key=lambda x: x['price'])
                    
                    if not variants:
                        row = soup.new_tag('div', attrs={'class': 'detail-row'})
                        span = soup.new_tag('span')
                        span.string = 'No other sizes listed'
                        row.append(span)
                        price_details.append(row)
                    else:
                        for idx, v in enumerate(variants[:3]): # Max 3 detail rows
                            row = soup.new_tag('div', attrs={'class': 'detail-row'})
                            
                            title_span = soup.new_tag('span')
                            title_span.string = v['title']
                            row.append(title_span)
                            row.append("\n                            ")
                            
                            pr_span = soup.new_tag('span', attrs={'class': 'detail-price'})
                            pr_val = v['price']
                            pr_span.string = f"₹{pr_val:,.0f}" if pr_val.is_integer() else f"₹{pr_val:,.2f}"
                            row.append(pr_span)
                            row.append("\n                        ")
                            
                            price_details.append(row)
                            if idx < len(variants[:3]) - 1:
                                price_details.append("\n                        ")
                                
    # Calculate best value cards and set best-price class & badge
    print("Calculating best value winners...")
    for oil_type in oil_types:
        valid_prices = []
        for brand in brands:
            bd = data.get(brand, {}).get(oil_type)
            if bd and bd.get('price_1l') is not None and bd.get('available', True):
                valid_prices.append((brand, bd['price_1l']))
                
        if valid_prices:
            min_price = min(p[1] for p in valid_prices)
            winners = [p[0] for p in valid_prices if p[1] == min_price]
            
            # Update cards with best badge
            for winner in winners:
                card_id = f"{oil_type}-{winner}"
                card_div = soup.find('div', id=card_id)
                if card_div:
                    card_div.attrs['class'].append('best-price')
                    
                    badge_div = soup.new_tag('div', attrs={'class': 'best-badge'})
                    badge_div.string = 'Best Value'
                    card_div.insert(0, badge_div)
                    card_div.insert(1, "\n                    ")
                    
    # 2. Update Quick Comparison Table
    print("Updating comparison table...")
    for oil_type in oil_types:
        row = soup.find('tr', id=f"price-row-{oil_type}")
        if not row:
            continue
            
        cells = row.find_all('td')
        if len(cells) < 5:
            continue
            
        # cells[0] is name, cells[1] is Anveshan, cells[2] is Gramiyaa, cells[3] is Two Brothers, cells[4] is Winner Badge
        prices_by_brand = {}
        for idx, brand in enumerate(brands):
            cell = cells[idx + 1]
            cell.clear()
            # remove best-cell class
            cell.attrs['class'] = [c for c in cell.attrs.get('class', []) if c != 'best-cell']
            
            bd = data.get(brand, {}).get(oil_type)
            if bd and bd.get('price_1l') is not None:
                p = bd['price_1l']
                prices_by_brand[brand] = p
                cell.string = f"₹{p:,.0f}" if p.is_integer() else f"₹{p:,.2f}"
            else:
                cell.attrs['class'].append('na-cell')
                cell.string = "—"
                
        # Find winner for table
        winner_cell = cells[4]
        winner_cell.clear()
        
        valid_prices = [(b, p) for b, p in prices_by_brand.items() if data[b][oil_type].get('available', True)]
        if valid_prices:
            min_price = min(p[1] for p in valid_prices)
            winners = [p[0] for p in valid_prices if p[1] == min_price]
            
            # Apply best-cell class to winner cells
            for w in winners:
                w_idx = brands.index(w)
                cells[w_idx + 1].attrs['class'].append('best-cell')
                
            # Create winner badge
            # If multiple winners, we can show multiple badges or just the first
            w_brand = winners[0]
            badge_span = soup.new_tag('span', attrs={'class': f'winner-badge {w_brand}'})
            badge_span.string = brand_titles[w_brand]
            winner_cell.append(badge_span)
        else:
            winner_cell.string = "—"
            
    # 3. Update Marketplace Table "Official" prices
    print("Updating marketplace official prices...")
    for brand in brands:
        for oil_type in oil_types:
            row = soup.find('tr', id=f"channel-row-{brand}-{oil_type}")
            if not row:
                continue
                
            official_cell = row.find('td', class_='ch-official')
            if official_cell:
                official_cell.clear()
                bd = data.get(brand, {}).get(oil_type)
                if bd and bd.get('price_1l') is not None:
                    p = bd['price_1l']
                    official_cell.string = f"₹{p:,.0f}" if p.is_integer() else f"₹{p:,.2f}"
                else:
                    official_cell.string = "—"
                    
    # 4. Update dynamic date in header
    update_date_el = soup.find(id='update-date')
    current_date_str = f"{datetime.now().strftime('%B')} {datetime.now().day}, {datetime.now().strftime('%Y')}"
    if update_date_el:
        update_date_el.string = current_date_str
        print(f"Updated header date to: {current_date_str}")
        
    # 5. Update date in disclaimer note
    notes_section = soup.find('section', id='notes')
    if notes_section:
        li_elements = notes_section.find_all('li')
        for li in li_elements:
            if 'Last verified:' in li.text:
                li.clear()
                strong = soup.new_tag('strong')
                strong.string = 'Last verified:'
                li.append(strong)
                li.append(f" {current_date_str}. Verify on official stores before purchase.")
                print(f"Updated notes disclaimer date.")
                break
                
    # Save the updated HTML
    with open(HTML_FILE, 'w', encoding='utf-8') as f:
        f.write(str(soup))
    print(f"Successfully updated {HTML_FILE}!")

if __name__ == "__main__":
    run_scraper()
