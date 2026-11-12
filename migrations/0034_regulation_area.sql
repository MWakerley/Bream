-- "Regulation": the keyholder register and safeguarding, now a right of its
-- own in What people can see, so only some of those with the Admin Centre see
-- them. Given to every profile that has the Admin Centre today, so nobody
-- loses anything on the day this runs; take it off a profile to hide them.
INSERT OR IGNORE INTO profile_areas (profile_id, area)
SELECT profile_id, 'regulation' FROM profile_areas WHERE area = 'settings';
