import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Bike, Clock, MapPin, Search, Star, Store, Utensils, X } from 'lucide-react';
import { useTripleTap } from '../state/useTripleTap';
import './DeliveryCover.css';

const CUISINES = ['All cuisines', 'Burgers', 'Pizza', 'Bowls'] as const;
type Cuisine = (typeof CUISINES)[number];
type OrderMode = 'Delivery' | 'Pickup';

interface Restaurant {
  id: string;
  name: string;
  cuisine: Exclude<Cuisine, 'All cuisines'>;
  neighborhood: string;
  rating: string;
  ratings: number;
  deliveryTime: string;
  deliveryFee: string;
  pickupTime: string;
  menu: readonly { name: string; description: string; price: string }[];
}

const RESTAURANTS: Restaurant[] = [
  {
    id: 'burger',
    name: 'Copper Bun Kitchen',
    cuisine: 'Burgers',
    neighborhood: 'Westown',
    rating: '4.8',
    ratings: 246,
    deliveryTime: '20–30 min',
    deliveryFee: '$1.99 delivery',
    pickupTime: '10–15 min',
    menu: [
      { name: 'Double Smash Burger', description: 'Two patties, cheddar, pickles, and house sauce on a toasted bun.', price: '$12.50' },
      { name: 'Seasoned Fries', description: 'Crisp-cut fries with a side of house sauce.', price: '$5.00' },
    ],
  },
  {
    id: 'pizza',
    name: 'Brick & Basil Pizza',
    cuisine: 'Pizza',
    neighborhood: 'Historic Third Ward',
    rating: '4.9',
    ratings: 182,
    deliveryTime: '30–40 min',
    deliveryFee: '$2.49 delivery',
    pickupTime: '15–20 min',
    menu: [
      { name: 'Margherita Pizza', description: 'Wood-fired crust with fresh mozzarella, tomato, and basil.', price: '$15.00' },
      { name: 'Pepperoni Pizza', description: 'Crisp pepperoni, mozzarella, and crushed tomato.', price: '$17.00' },
    ],
  },
  {
    id: 'bowl',
    name: 'Bright Bowl Counter',
    cuisine: 'Bowls',
    neighborhood: 'Juneautown',
    rating: '4.7',
    ratings: 129,
    deliveryTime: '25–35 min',
    deliveryFee: '$1.49 delivery',
    pickupTime: '10–20 min',
    menu: [
      { name: 'Salmon & Avocado Bowl', description: 'Rice, salmon, avocado, edamame, and pickled vegetables.', price: '$14.50' },
      { name: 'Sesame Crunch Bowl', description: 'Cabbage, carrots, cucumber, and rice with sesame dressing.', price: '$11.50' },
    ],
  },
];

const ORDER_MODES: { value: OrderMode; icon: typeof Bike }[] = [
  { value: 'Delivery', icon: Bike },
  { value: 'Pickup', icon: Store },
];

/**
 * Quick Exit cover (#8): an ordinary-looking food delivery site.
 * Two ways back: the "Return to Portal" link in the footer, or three deliberate taps on the white header bar (#10).
 */
export default function DeliveryCover({ onReturn }: { onReturn: () => void }) {
  const tripleTap = useTripleTap(onReturn);
  const [mode, setMode] = useState<OrderMode>('Delivery');
  const [cuisine, setCuisine] = useState<Cuisine>('All cuisines');
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<Restaurant | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const menuDialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const previousTitle = document.title;
    const previousLang = document.documentElement.lang;
    document.title = 'Supper Lane | Food delivery';
    document.documentElement.lang = 'en'; // the cover is an English site, whatever language the app was in
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
    return () => {
      document.title = previousTitle;
      document.documentElement.lang = previousLang;
    };
  }, []);

  useEffect(() => {
    const dialog = menuDialog.current;
    if (menu && dialog && !dialog.open) dialog.showModal();
  }, [menu]);

  const search = query.trim().toLowerCase();
  const restaurants = RESTAURANTS.filter((restaurant) => {
    if (cuisine !== 'All cuisines' && cuisine !== restaurant.cuisine) return false;
    const searchable = [restaurant.name, restaurant.cuisine, restaurant.neighborhood, ...restaurant.menu.map((item) => item.name)];
    return searchable.some((value) => value.toLowerCase().includes(search));
  });

  return (
    <main className="delivery-cover" aria-labelledby="delivery-cover-title">
      <header className="delivery-header" {...tripleTap}>
        <div className="delivery-width delivery-header-inner">
          <div className="delivery-brand"><span><Utensils size={20} aria-hidden="true" /></span> Supper Lane</div>
          <div className="delivery-location"><MapPin size={18} aria-hidden="true" /> Milwaukee, WI</div>
          <div className="delivery-mode" role="group" aria-label="Order type">
            {ORDER_MODES.map(({ value, icon: Icon }) => (
              <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>
                <Icon size={17} aria-hidden="true" /> {value}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="delivery-width delivery-body">
        <section className="delivery-hero">
          <div className="delivery-hero-copy">
            <h1 id="delivery-cover-title" ref={heading} tabIndex={-1}>Dinner, handled.</h1>
            <p>Browse neighborhood kitchens for delivery or pickup.</p>
          </div>
          <div className="delivery-hero-visual" aria-hidden="true">
            <div className="delivery-photo delivery-photo--spread" />
          </div>
        </section>

        <section className="delivery-catalog" aria-labelledby="delivery-catalog-title">
          <div className="delivery-catalog-header">
            <h2 id="delivery-catalog-title">Restaurants near you</h2>
            <label className="delivery-search">
              <Search size={19} aria-hidden="true" />
              <input aria-label="Search restaurants or dishes" type="search" placeholder="Search restaurants or dishes" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </div>
          <div className="delivery-cuisines" role="group" aria-label="Filter by cuisine">
            {CUISINES.map((choice) => (
              <button key={choice} type="button" aria-pressed={cuisine === choice} onClick={() => setCuisine(choice)}>
                {choice}
              </button>
            ))}
          </div>

          {restaurants.length === 0 ? (
            <p className="delivery-empty" role="status">No restaurants match your search.</p>
          ) : (
            <ul className="delivery-restaurants">
              {restaurants.map((restaurant) => (
                <li key={restaurant.id} className="delivery-restaurant">
                  <div className={`delivery-photo delivery-photo--${restaurant.id}`} aria-hidden="true" />
                  <div className="delivery-restaurant-body">
                    <div className="delivery-card-title">
                      <h3>{restaurant.name}</h3>
                      <span className="delivery-rating" aria-label={`${restaurant.rating} stars from ${restaurant.ratings} ratings`}>
                        <Star size={14} fill="currentColor" aria-hidden="true" /> {restaurant.rating}
                      </span>
                    </div>
                    <p>{restaurant.cuisine} · {restaurant.neighborhood}</p>
                    <div className="delivery-card-meta">
                      <span><Clock size={15} aria-hidden="true" /> {mode === 'Delivery' ? restaurant.deliveryTime : restaurant.pickupTime}</span>
                      <span>{mode === 'Delivery' ? restaurant.deliveryFee : 'Free pickup'}</span>
                    </div>
                    <button className="delivery-menu-button" type="button" aria-label={`View menu for ${restaurant.name}`} onClick={() => setMenu(restaurant)}>
                      View menu <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="delivery-footer">
          <span>Sample catalog</span>
          <button type="button" onClick={onReturn}>Return to Portal</button>
        </footer>
      </div>

      {menu && (
        <dialog ref={menuDialog} className="delivery-dialog" aria-labelledby="delivery-menu-title" onClose={() => setMenu(null)}>
          <div className="delivery-dialog-heading">
            <div><h2 id="delivery-menu-title">{menu.name}</h2><p>{menu.cuisine} · {menu.neighborhood}</p></div>
            <button type="button" aria-label="Close menu" onClick={() => menuDialog.current?.close()}><X size={22} aria-hidden="true" /></button>
          </div>
          <ul>
            {menu.menu.map((item) => (
              <li key={item.name}>
                <div><h3>{item.name}</h3><p>{item.description}</p></div>
                <strong>{item.price}</strong>
              </li>
            ))}
          </ul>
        </dialog>
      )}
    </main>
  );
}
