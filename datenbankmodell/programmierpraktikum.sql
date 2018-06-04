-- phpMyAdmin SQL Dump
-- version 4.8.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Erstellungszeit: 02. Jun 2018 um 00:55
-- Server-Version: 10.1.33-MariaDB
-- PHP-Version: 7.2.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Datenbank: `programmierpraktikum`
--

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `compartments`
--

CREATE TABLE `compartments` (
  `id` int(11) NOT NULL,
  `x` int(11) NOT NULL,
  `y` int(11) NOT NULL,
  `no` int(11) NOT NULL,
  `amount` int(11) NOT NULL,
  `product` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `log`
--

CREATE TABLE `log` (
  `id` int(11) NOT NULL,
  `product` int(11) DEFAULT NULL,
  `unix` int(11) NOT NULL,
  `frontend_update` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tabellenstruktur für Tabelle `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `name` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
  `producer` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` tinytext COLLATE utf8mb4_unicode_ci NOT NULL,
  `max-amount` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Daten für Tabelle `products`
--

INSERT INTO `products` (`id`, `name`, `producer`, `description`, `max-amount`) VALUES
(1, 'ShirtA', 'ShirtCompanyA', 'Nice t-shirt', 0),
(2, 'ShirtB', 'ShirtCompanyB', 'Nice t-shirt', 0),
(3, 'ShirtC', 'ShirtCompanyC', 'Nice t-shirt', 0),
(4, 'ShirtD', 'ShirtCompanyD', 'Nice t-shirt', 0),
(5, 'ShirtE', 'ShirtCompanyE', 'Nice t-shirt', 0),
(6, 'ShirtF', 'ShirtCompanyF', 'Nice t-shirt', 0),
(7, 'ShirtG', 'ShirtCompanyG', 'Nice t-shirt', 0),
(8, 'ShirtH', 'ShirtCompanyH', 'Nice t-shirt', 0),
(9, 'ShirtI', 'ShirtCompanyI', 'Nice t-shirt', 0),
(10, 'ShirtJ', 'ShirtCompanyJ', 'Nice t-shirt', 0),
(11, 'ShirtK', 'ShirtCompanyK', 'Nice t-shirt', 0),
(12, 'ShirtL', 'ShirtCompanyL', 'Nice t-shirt', 0),
(13, 'ShirtM', 'ShirtCompanyM', 'Nice t-shirt', 0),
(14, 'ShirtN', 'ShirtCompanyN', 'Nice t-shirt', 0),
(15, 'ShirtO', 'ShirtCompanyO', 'Nice t-shirt', 0),
(16, 'ShirtP', 'ShirtCompanyP', 'Nice t-shirt', 0),
(17, 'ShirtQ', 'ShirtCompanyQ', 'Nice t-shirt', 0),
(18, 'ShirtR', 'ShirtCompanyR', 'Nice t-shirt', 0),
(19, 'ShirtS', 'ShirtCompanyS', 'Nice t-shirt', 0),
(20, 'ShirtT', 'ShirtCompanyT', 'Nice t-shirt', 0),
(21, 'ShirtU', 'ShirtCompanyU', 'Nice t-shirt', 0),
(22, 'ShirtV', 'ShirtCompanyV', 'Nice t-shirt', 0),
(23, 'ShirtW', 'ShirtCompanyW', 'Nice t-shirt', 0),
(24, 'ShirtX', 'ShirtCompanyX', 'Nice t-shirt', 0),
(25, 'ShirtY', 'ShirtCompanyY', 'Nice t-shirt', 0),
(26, 'ShirtZ', 'ShirtCompanyZ', 'Nice t-shirt', 0),
(27, 'ShoesA', 'ShoeIncA', 'Slick Shoes', 0),
(28, 'ShoesB', 'ShoeIncB', 'Slick Shoes', 0),
(29, 'ShoesC', 'ShoeIncC', 'Slick Shoes', 0),
(30, 'ShoesD', 'ShoeIncD', 'Slick Shoes', 0),
(31, 'ShoesE', 'ShoeIncE', 'Slick Shoes', 0),
(32, 'ShoesF', 'ShoeIncF', 'Slick Shoes', 0),
(33, 'ShoesG', 'ShoeIncG', 'Slick Shoes', 0),
(34, 'ShoesH', 'ShoeIncH', 'Slick Shoes', 0),
(35, 'ShoesI', 'ShoeIncI', 'Slick Shoes', 0),
(36, 'ShoesJ', 'ShoeIncJ', 'Slick Shoes', 0),
(37, 'ShoesK', 'ShoeIncK', 'Slick Shoes', 0),
(38, 'ShoesL', 'ShoeIncL', 'Slick Shoes', 0),
(39, 'ShoesM', 'ShoeIncM', 'Slick Shoes', 0),
(40, 'ShoesN', 'ShoeIncN', 'Slick Shoes', 0),
(41, 'ShoesO', 'ShoeIncO', 'Slick Shoes', 0),
(42, 'ShoesP', 'ShoeIncP', 'Slick Shoes', 0),
(43, 'ShoesQ', 'ShoeIncQ', 'Slick Shoes', 0),
(44, 'ShoesR', 'ShoeIncR', 'Slick Shoes', 0),
(45, 'ShoesS', 'ShoeIncS', 'Slick Shoes', 0),
(46, 'ShoesT', 'ShoeIncT', 'Slick Shoes', 0),
(47, 'ShoesU', 'ShoeIncU', 'Slick Shoes', 0),
(48, 'ShoesV', 'ShoeIncV', 'Slick Shoes', 0),
(49, 'ShoesW', 'ShoeIncW', 'Slick Shoes', 0),
(50, 'ShoesX', 'ShoeIncX', 'Slick Shoes', 0),
(51, 'ShoesY', 'ShoeIncY', 'Slick Shoes', 0),
(52, 'ShoesZ', 'ShoeIncZ', 'Slick Shoes', 0),
(53, 'PantsA', 'PantsProductionsA', 'Sweet Pants', 0),
(54, 'PantsB', 'PantsProductionsB', 'Sweet Pants', 0),
(55, 'PantsC', 'PantsProductionsC', 'Sweet Pants', 0),
(56, 'PantsD', 'PantsProductionsD', 'Sweet Pants', 0),
(57, 'PantsE', 'PantsProductionsE', 'Sweet Pants', 0),
(58, 'PantsF', 'PantsProductionsF', 'Sweet Pants', 0),
(59, 'PantsG', 'PantsProductionsG', 'Sweet Pants', 0),
(60, 'PantsH', 'PantsProductionsH', 'Sweet Pants', 0),
(61, 'PantsI', 'PantsProductionsI', 'Sweet Pants', 0),
(62, 'PantsJ', 'PantsProductionsJ', 'Sweet Pants', 0),
(63, 'PantsK', 'PantsProductionsK', 'Sweet Pants', 0),
(64, 'PantsL', 'PantsProductionsL', 'Sweet Pants', 0),
(65, 'PantsM', 'PantsProductionsM', 'Sweet Pants', 0),
(66, 'PantsN', 'PantsProductionsN', 'Sweet Pants', 0),
(67, 'PantsO', 'PantsProductionsO', 'Sweet Pants', 0),
(68, 'PantsP', 'PantsProductionsP', 'Sweet Pants', 0),
(69, 'PantsQ', 'PantsProductionsQ', 'Sweet Pants', 0),
(70, 'PantsR', 'PantsProductionsR', 'Sweet Pants', 0),
(71, 'PantsS', 'PantsProductionsS', 'Sweet Pants', 0),
(72, 'PantsT', 'PantsProductionsT', 'Sweet Pants', 0),
(73, 'PantsU', 'PantsProductionsU', 'Sweet Pants', 0),
(74, 'PantsV', 'PantsProductionsV', 'Sweet Pants', 0),
(75, 'PantsW', 'PantsProductionsW', 'Sweet Pants', 0),
(76, 'PantsX', 'PantsProductionsX', 'Sweet Pants', 0),
(77, 'PantsY', 'PantsProductionsY', 'Sweet Pants', 0),
(78, 'PantsZ', 'PantsProductionsZ', 'Sweet Pants', 0),
(79, 'WatchA', 'ClocksAndMoreA', 'Luxery Wrist Watch', 0),
(80, 'WatchB', 'ClocksAndMoreB', 'Luxery Wrist Watch', 0),
(81, 'WatchC', 'ClocksAndMoreC', 'Luxery Wrist Watch', 0),
(82, 'WatchD', 'ClocksAndMoreD', 'Luxery Wrist Watch', 0),
(83, 'WatchE', 'ClocksAndMoreE', 'Luxery Wrist Watch', 0),
(84, 'WatchF', 'ClocksAndMoreF', 'Luxery Wrist Watch', 0),
(85, 'WatchG', 'ClocksAndMoreG', 'Luxery Wrist Watch', 0),
(86, 'WatchH', 'ClocksAndMoreH', 'Luxery Wrist Watch', 0),
(87, 'WatchI', 'ClocksAndMoreI', 'Luxery Wrist Watch', 0),
(88, 'WatchJ', 'ClocksAndMoreJ', 'Luxery Wrist Watch', 0),
(89, 'WatchK', 'ClocksAndMoreK', 'Luxery Wrist Watch', 0),
(90, 'WatchL', 'ClocksAndMoreL', 'Luxery Wrist Watch', 0),
(91, 'WatchM', 'ClocksAndMoreM', 'Luxery Wrist Watch', 0),
(92, 'WatchN', 'ClocksAndMoreN', 'Luxery Wrist Watch', 0),
(93, 'WatchO', 'ClocksAndMoreO', 'Luxery Wrist Watch', 0),
(94, 'WatchP', 'ClocksAndMoreP', 'Luxery Wrist Watch', 0),
(95, 'WatchQ', 'ClocksAndMoreQ', 'Luxery Wrist Watch', 0),
(96, 'WatchR', 'ClocksAndMoreR', 'Luxery Wrist Watch', 0),
(97, 'WatchS', 'ClocksAndMoreS', 'Luxery Wrist Watch', 0),
(98, 'WatchT', 'ClocksAndMoreT', 'Luxery Wrist Watch', 0),
(99, 'WatchU', 'ClocksAndMoreU', 'Luxery Wrist Watch', 0),
(100, 'WatchV', 'ClocksAndMoreV', 'Luxery Wrist Watch', 0),
(101, 'WatchW', 'ClocksAndMoreW', 'Luxery Wrist Watch', 0),
(102, 'WatchX', 'ClocksAndMoreX', 'Luxery Wrist Watch', 0),
(103, 'WatchY', 'ClocksAndMoreY', 'Luxery Wrist Watch', 0),
(104, 'WatchZ', 'ClocksAndMoreZ', 'Luxery Wrist Watch', 0),
(105, 'PhoneA', 'ManufacturerA', 'Glorious smarpthone never seen before', 0),
(106, 'PhoneB', 'ManufacturerB', 'Glorious smarpthone never seen before', 0),
(107, 'PhoneC', 'ManufacturerC', 'Glorious smarpthone never seen before', 0),
(108, 'PhoneD', 'ManufacturerD', 'Glorious smarpthone never seen before', 0),
(109, 'PhoneE', 'ManufacturerE', 'Glorious smarpthone never seen before', 0),
(110, 'PhoneF', 'ManufacturerF', 'Glorious smarpthone never seen before', 0),
(111, 'PhoneG', 'ManufacturerG', 'Glorious smarpthone never seen before', 0),
(112, 'PhoneH', 'ManufacturerH', 'Glorious smarpthone never seen before', 0),
(113, 'PhoneI', 'ManufacturerI', 'Glorious smarpthone never seen before', 0),
(114, 'PhoneJ', 'ManufacturerJ', 'Glorious smarpthone never seen before', 0),
(115, 'PhoneK', 'ManufacturerK', 'Glorious smarpthone never seen before', 0),
(116, 'PhoneL', 'ManufacturerL', 'Glorious smarpthone never seen before', 0),
(117, 'PhoneM', 'ManufacturerM', 'Glorious smarpthone never seen before', 0),
(118, 'PhoneN', 'ManufacturerN', 'Glorious smarpthone never seen before', 0),
(119, 'PhoneO', 'ManufacturerO', 'Glorious smarpthone never seen before', 0),
(120, 'PhoneP', 'ManufacturerP', 'Glorious smarpthone never seen before', 0),
(121, 'PhoneQ', 'ManufacturerQ', 'Glorious smarpthone never seen before', 0),
(122, 'PhoneR', 'ManufacturerR', 'Glorious smarpthone never seen before', 0),
(123, 'PhoneS', 'ManufacturerS', 'Glorious smarpthone never seen before', 0),
(124, 'PhoneT', 'ManufacturerT', 'Glorious smarpthone never seen before', 0),
(125, 'PhoneU', 'ManufacturerU', 'Glorious smarpthone never seen before', 0),
(126, 'PhoneV', 'ManufacturerV', 'Glorious smarpthone never seen before', 0),
(127, 'PhoneW', 'ManufacturerW', 'Glorious smarpthone never seen before', 0),
(128, 'PhoneX', 'ManufacturerX', 'Glorious smarpthone never seen before', 0),
(129, 'PhoneY', 'ManufacturerY', 'Glorious smarpthone never seen before', 0),
(130, 'PhoneZ', 'ManufacturerZ', 'Glorious smarpthone never seen before', 0),
(131, 'CameraA', 'LensFacturerA', 'Camera with 40x optical zoom', 0),
(132, 'CameraB', 'LensFacturerB', 'Camera with 40x optical zoom', 0),
(133, 'CameraC', 'LensFacturerC', 'Camera with 40x optical zoom', 0),
(134, 'CameraD', 'LensFacturerD', 'Camera with 40x optical zoom', 0),
(135, 'CameraE', 'LensFacturerE', 'Camera with 40x optical zoom', 0),
(136, 'CameraF', 'LensFacturerF', 'Camera with 40x optical zoom', 0),
(137, 'CameraG', 'LensFacturerG', 'Camera with 40x optical zoom', 0),
(138, 'CameraH', 'LensFacturerH', 'Camera with 40x optical zoom', 0),
(139, 'CameraI', 'LensFacturerI', 'Camera with 40x optical zoom', 0),
(140, 'CameraJ', 'LensFacturerJ', 'Camera with 40x optical zoom', 0),
(141, 'CameraK', 'LensFacturerK', 'Camera with 40x optical zoom', 0),
(142, 'CameraL', 'LensFacturerL', 'Camera with 40x optical zoom', 0),
(143, 'CameraM', 'LensFacturerM', 'Camera with 40x optical zoom', 0),
(144, 'CameraN', 'LensFacturerN', 'Camera with 40x optical zoom', 0),
(145, 'CameraO', 'LensFacturerO', 'Camera with 40x optical zoom', 0),
(146, 'CameraP', 'LensFacturerP', 'Camera with 40x optical zoom', 0),
(147, 'CameraQ', 'LensFacturerQ', 'Camera with 40x optical zoom', 0),
(148, 'CameraR', 'LensFacturerR', 'Camera with 40x optical zoom', 0),
(149, 'CameraS', 'LensFacturerS', 'Camera with 40x optical zoom', 0),
(150, 'CameraT', 'LensFacturerT', 'Camera with 40x optical zoom', 0),
(151, 'CameraU', 'LensFacturerU', 'Camera with 40x optical zoom', 0),
(152, 'CameraV', 'LensFacturerV', 'Camera with 40x optical zoom', 0),
(153, 'CameraW', 'LensFacturerW', 'Camera with 40x optical zoom', 0),
(154, 'CameraX', 'LensFacturerX', 'Camera with 40x optical zoom', 0),
(155, 'CameraY', 'LensFacturerY', 'Camera with 40x optical zoom', 0),
(156, 'CameraZ', 'LensFacturerZ', 'Camera with 40x optical zoom', 0),
(157, 'BookA', 'WriterPublisherA', 'One of the best fiction books', 0),
(158, 'BookB', 'WriterPublisherB', 'One of the best fiction books', 0),
(159, 'BookC', 'WriterPublisherC', 'One of the best fiction books', 0),
(160, 'BookD', 'WriterPublisherD', 'One of the best fiction books', 0),
(161, 'BookE', 'WriterPublisherE', 'One of the best fiction books', 0),
(162, 'BookF', 'WriterPublisherF', 'One of the best fiction books', 0),
(163, 'BookG', 'WriterPublisherG', 'One of the best fiction books', 0),
(164, 'BookH', 'WriterPublisherH', 'One of the best fiction books', 0),
(165, 'BookI', 'WriterPublisherI', 'One of the best fiction books', 0),
(166, 'BookJ', 'WriterPublisherJ', 'One of the best fiction books', 0),
(167, 'BookK', 'WriterPublisherK', 'One of the best fiction books', 0),
(168, 'BookL', 'WriterPublisherL', 'One of the best fiction books', 0),
(169, 'BookM', 'WriterPublisherM', 'One of the best fiction books', 0),
(170, 'BookN', 'WriterPublisherN', 'One of the best fiction books', 0),
(171, 'BookO', 'WriterPublisherO', 'One of the best fiction books', 0),
(172, 'BookP', 'WriterPublisherP', 'One of the best fiction books', 0),
(173, 'BookQ', 'WriterPublisherQ', 'One of the best fiction books', 0),
(174, 'BookR', 'WriterPublisherR', 'One of the best fiction books', 0),
(175, 'BookS', 'WriterPublisherS', 'One of the best fiction books', 0),
(176, 'BookT', 'WriterPublisherT', 'One of the best fiction books', 0),
(177, 'BookU', 'WriterPublisherU', 'One of the best fiction books', 0),
(178, 'BookV', 'WriterPublisherV', 'One of the best fiction books', 0),
(179, 'BookW', 'WriterPublisherW', 'One of the best fiction books', 0),
(180, 'BookX', 'WriterPublisherX', 'One of the best fiction books', 0),
(181, 'BookY', 'WriterPublisherY', 'One of the best fiction books', 0),
(182, 'BookZ', 'WriterPublisherZ', 'One of the best fiction books', 0),
(183, 'RucksackA', 'FabricatorA', 'Carrying all your life with you', 0),
(184, 'RucksackB', 'FabricatorB', 'Carrying all your life with you', 0),
(185, 'RucksackC', 'FabricatorC', 'Carrying all your life with you', 0),
(186, 'RucksackD', 'FabricatorD', 'Carrying all your life with you', 0),
(187, 'RucksackE', 'FabricatorE', 'Carrying all your life with you', 0),
(188, 'RucksackF', 'FabricatorF', 'Carrying all your life with you', 0),
(189, 'RucksackG', 'FabricatorG', 'Carrying all your life with you', 0),
(190, 'RucksackH', 'FabricatorH', 'Carrying all your life with you', 0),
(191, 'RucksackI', 'FabricatorI', 'Carrying all your life with you', 0),
(192, 'RucksackJ', 'FabricatorJ', 'Carrying all your life with you', 0),
(193, 'RucksackK', 'FabricatorK', 'Carrying all your life with you', 0),
(194, 'RucksackL', 'FabricatorL', 'Carrying all your life with you', 0),
(195, 'RucksackM', 'FabricatorM', 'Carrying all your life with you', 0),
(196, 'RucksackN', 'FabricatorN', 'Carrying all your life with you', 0),
(197, 'RucksackO', 'FabricatorO', 'Carrying all your life with you', 0),
(198, 'RucksackP', 'FabricatorP', 'Carrying all your life with you', 0),
(199, 'RucksackQ', 'FabricatorQ', 'Carrying all your life with you', 0),
(200, 'RucksackR', 'FabricatorR', 'Carrying all your life with you', 0),
(201, 'RucksackS', 'FabricatorS', 'Carrying all your life with you', 0),
(202, 'RucksackT', 'FabricatorT', 'Carrying all your life with you', 0),
(203, 'RucksackU', 'FabricatorU', 'Carrying all your life with you', 0),
(204, 'RucksackV', 'FabricatorV', 'Carrying all your life with you', 0),
(205, 'RucksackW', 'FabricatorW', 'Carrying all your life with you', 0),
(206, 'RucksackX', 'FabricatorX', 'Carrying all your life with you', 0),
(207, 'RucksackY', 'FabricatorY', 'Carrying all your life with you', 0),
(208, 'RucksackZ', 'FabricatorZ', 'Carrying all your life with you', 0);

--
-- Indizes der exportierten Tabellen
--

--
-- Indizes für die Tabelle `compartments`
--
ALTER TABLE `compartments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `compartments-product-id2` (`product`);

--
-- Indizes für die Tabelle `log`
--
ALTER TABLE `log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `2log-product-id2` (`product`);

--
-- Indizes für die Tabelle `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT für exportierte Tabellen
--

--
-- AUTO_INCREMENT für Tabelle `compartments`
--
ALTER TABLE `compartments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT für Tabelle `log`
--
ALTER TABLE `log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT für Tabelle `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=209;

--
-- Constraints der exportierten Tabellen
--

--
-- Constraints der Tabelle `compartments`
--
ALTER TABLE `compartments`
  ADD CONSTRAINT `compartments-product-id2` FOREIGN KEY (`product`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints der Tabelle `log`
--
ALTER TABLE `log`
  ADD CONSTRAINT `2log-product-id2` FOREIGN KEY (`product`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
